#!/usr/bin/env node
/**
 * Market Pulse CLI
 * Usage:
 *   npx tsx tools/market_pulse/src/cli.ts [options]
 *   node tools/market_pulse/dist/cli.js [options]
 *
 * Options:
 *   --date YYYY-MM-DD   Target date (default: today JST)
 *   --limit N           Max items per source (default: 30)
 *   --dry-run           Skip file writes
 */

import { writeFileSync, mkdirSync, existsSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

import { fetchAllSources } from "./fetch.js";
import { deduplicateItems, filterByDate, sortByDate } from "./normalize.js";
import { summarize } from "./summarize.js";
import { scoreItem } from "./score.js";
import { clusterItems } from "./cluster.js";
import { renderReport, renderIssueDraft } from "./render.js";
import type { NormalizedItem, ScoredItem } from "./types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
// dist/cli.js → ../.. → tools/market_pulse → ../.. → repo root (3 levels up from dist/)
const REPO_ROOT = join(__dirname, "..", "..", "..");

// ---- CLI arg parsing ----
function parseArgs(): { date: string; limit: number; dryRun: boolean } {
  const args = process.argv.slice(2);
  let date = todayJST();
  let limit = 30;
  let dryRun = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--date" && args[i + 1]) {
      date = args[++i];
    } else if (args[i] === "--limit" && args[i + 1]) {
      limit = parseInt(args[++i], 10);
    } else if (args[i] === "--dry-run") {
      dryRun = true;
    }
  }

  return { date, limit, dryRun };
}

function todayJST(): string {
  const d = new Date(Date.now() + 9 * 60 * 60 * 1000); // UTC+9
  return d.toISOString().slice(0, 10);
}

function ensureDir(p: string) {
  if (!existsSync(p)) mkdirSync(p, { recursive: true });
}

// RAW JSONL のローテーション（最大5000行）
const RAW_MAX_LINES = 5000;

function appendRawJsonl(
  rawPath: string,
  items: NormalizedItem[],
  dryRun: boolean
): void {
  const newLines = items.map((it) => JSON.stringify(it)).join("\n") + "\n";

  if (dryRun) {
    console.log(`[dry-run] Would append ${items.length} lines to ${rawPath}`);
    return;
  }

  let existing = "";
  if (existsSync(rawPath)) {
    existing = readFileSync(rawPath, "utf-8");
  }

  const combined = existing + newLines;
  const lines = combined.split("\n").filter(Boolean);
  const rotated = lines.slice(-RAW_MAX_LINES).join("\n") + "\n";
  writeFileSync(rawPath, rotated, "utf-8");
}

async function main() {
  const { date, limit, dryRun } = parseArgs();
  console.log(`\n=== Market Pulse ===`);
  console.log(`Date: ${date} | Limit: ${limit}/source | DryRun: ${dryRun}`);
  console.log("Fetching sources...\n");

  // 1. Fetch
  const fetchResults = await fetchAllSources(limit);
  const successCount = fetchResults.filter((r) => !r.error).length;
  const errorCount = fetchResults.filter((r) => r.error).length;
  console.log(`Fetched: ${successCount} OK, ${errorCount} failed`);

  if (errorCount > 0) {
    for (const r of fetchResults.filter((r) => r.error)) {
      console.warn(`  WARN [${r.sourceId}]: ${r.error}`);
    }
  }

  // 完全失敗チェック
  const allItems = fetchResults.flatMap((r) => r.items);
  if (allItems.length === 0 && successCount === 0) {
    console.error("FATAL: All sources failed. Exiting with code 1.");
    process.exit(1);
  }

  // 2. Normalize
  // 48時間以内のアイテムに絞る
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);
  const normalized = sortByDate(deduplicateItems(filterByDate(allItems, cutoff)));
  console.log(`After dedup+filter: ${normalized.length} items`);

  // 3. Summarize + Score
  const scoredItems: ScoredItem[] = [];
  for (const item of normalized) {
    const summary = await summarize(item);
    const score = scoreItem(item);
    scoredItems.push({ ...item, summary, score });
  }

  // スコア降順でソート
  scoredItems.sort((a, b) => b.score.total - a.score.total);

  // 4. Cluster
  const clusters = clusterItems(scoredItems);
  console.log(`Clusters: ${clusters.length}`);

  // 5. Render report
  const report = renderReport(date, clusters, fetchResults, normalized.length);

  // 6. Top candidates (上位50)
  const candidates = scoredItems.slice(0, 50).map((it) => ({
    id: it.id,
    url: it.url,
    title: it.title,
    source: it.source,
    sourceName: it.sourceName,
    publishedAt: it.publishedAt,
    score: it.score,
    tags: it.tags,
    summaryBullets: it.summary.bullets,
  }));

  // 7. Issue drafts (上位10のうちスコア≥15のもの)
  const issueCandidates = scoredItems
    .filter((it) => it.score.total >= 15)
    .slice(0, 10);

  // 8. Output
  const reportsDir = join(REPO_ROOT, "reports", "market_pulse");
  const issuesDir = join(REPO_ROOT, "issues", "auto_generated", date);
  const rawPath = join(reportsDir, "raw.jsonl");

  if (!dryRun) {
    ensureDir(reportsDir);
    ensureDir(issuesDir);

    // メインレポート
    writeFileSync(join(reportsDir, `${date}.md`), report, "utf-8");
    console.log(`  -> reports/market_pulse/${date}.md`);

    // candidates.json
    writeFileSync(
      join(reportsDir, "candidates.json"),
      JSON.stringify(candidates, null, 2),
      "utf-8"
    );
    console.log("  -> reports/market_pulse/candidates.json");

    // raw.jsonl
    appendRawJsonl(rawPath, normalized, false);
    console.log(`  -> reports/market_pulse/raw.jsonl (${normalized.length} items appended)`);

    // Issue drafts
    for (const item of issueCandidates) {
      const { slug, content } = renderIssueDraft(item, date);
      writeFileSync(join(issuesDir, `${slug}.md`), content, "utf-8");
    }
    console.log(`  -> issues/auto_generated/${date}/ (${issueCandidates.length} drafts)`);
  } else {
    // Dry run: コンソールにサマリを出力
    console.log("\n[dry-run] Would write:");
    console.log(`  reports/market_pulse/${date}.md`);
    console.log("  reports/market_pulse/candidates.json");
    console.log("  reports/market_pulse/raw.jsonl");
    console.log(`  issues/auto_generated/${date}/*.md (${issueCandidates.length} files)`);
    console.log("\n--- Report preview (first 50 lines) ---");
    console.log(report.split("\n").slice(0, 50).join("\n"));
    console.log("...");
    console.log("\n--- Top 5 candidates ---");
    for (const c of candidates.slice(0, 5)) {
      console.log(`  [${c.score.total}] ${c.title.slice(0, 70)}`);
    }

    // dry-runでも raw.jsonl には書かない
    console.log(`\n[dry-run] Would append ${normalized.length} items to raw.jsonl`);
  }

  console.log("\nDone.");
}

main().catch((e) => {
  console.error("Unhandled error:", e);
  process.exit(1);
});
