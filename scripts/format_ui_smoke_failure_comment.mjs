#!/usr/bin/env node
/**
 * format_ui_smoke_failure_comment.mjs — dry-run formatter for ui-smoke PR comment
 *
 * Usage (local dry-run):
 *   node scripts/format_ui_smoke_failure_comment.mjs \
 *     --summary reports/ui-smoke/latest/summary.json \
 *     --sha abc1234 \
 *     --run-url https://github.com/owner/repo/actions/runs/123456 \
 *     --artifact-name ui-smoke-failure-abc1234
 *
 * Reads summary.json + network_failures.json + pageerror.log from
 * the same directory as --summary, then prints the Markdown comment body.
 *
 * Used in CI via: node scripts/format_ui_smoke_failure_comment.mjs ...
 * Output is captured and posted to GitHub PR via gh CLI or github-script.
 */

import { readFileSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

function maskUrl(url) {
  try {
    const u = new URL(url);
    if (u.search) u.search = "?***";
    if (u.hash) u.hash = "";
    return u.origin + u.pathname;
  } catch {
    return String(url).replace(/\?.*/, "?***");
  }
}

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    if (argv[i].startsWith("--")) {
      const key = argv[i].slice(2);
      args[key] = argv[i + 1] ?? "";
      i++;
    }
  }
  return args;
}

const args = parseArgs(process.argv);
const summaryPath = args["summary"] ?? "reports/ui-smoke/latest/summary.json";
const sha = args["sha"] ?? "unknown";
const runUrl = args["run-url"] ?? "";
const artifactName = args["artifact-name"] ?? `ui-smoke-failure-${sha}`;

if (!existsSync(summaryPath)) {
  // No summary.json — emit minimal comment
  const marker = "<!-- UI_SMOKE_FAIL_DETAIL -->";
  const shortSha = sha.slice(0, 7);
  let body = `${marker}\n`;
  body += `### ❌ ui-smoke failed\n\n`;
  body += `- **sha:** \`${shortSha}\`\n`;
  if (runUrl) body += `- **run:** [Actions run](${runUrl})\n`;
  body += `- **diagnostic artifacts:** \`${artifactName}\` _(download from Actions run → Artifacts)_\n`;
  body += `- **detail:** No \`summary.json\` found — check raw logs\n`;
  process.stdout.write(body);
  process.exit(0);
}

const summaryDir = dirname(summaryPath);
const summary = JSON.parse(readFileSync(summaryPath, "utf8"));

// Read optional supporting files
const networkFailuresPath = join(summaryDir, "network_failures.json");
const pageErrorPath = join(summaryDir, "pageerror.log");

let networkFailures = [];
if (existsSync(networkFailuresPath)) {
  try { networkFailures = JSON.parse(readFileSync(networkFailuresPath, "utf8")); } catch {}
}

let pageErrors = "";
if (existsSync(pageErrorPath)) {
  pageErrors = readFileSync(pageErrorPath, "utf8").trim();
}

// Build comment
const marker = "<!-- UI_SMOKE_FAIL_DETAIL -->";
const shortSha = sha.slice(0, 7);
const failedTests = (summary.results ?? []).filter((r) => r.status === "FAIL");
const topFails = failedTests.slice(0, 4);

let body = `${marker}\n`;
body += `### ❌ ui-smoke failed\n\n`;
body += `| | |\n|---|---|\n`;
body += `| **sha** | \`${shortSha}\` |\n`;
if (runUrl) body += `| **run** | [Actions run ↗](${runUrl}) |\n`;
body += `| **artifacts** | \`${artifactName}\` _(Actions → Artifacts)_ |\n`;
body += `| **result** | ${summary.fail ?? 0} FAIL / ${summary.pass ?? 0} PASS / ${summary.skip ?? 0} SKIP |\n`;
body += `\n`;

// Top failing tests
if (topFails.length > 0) {
  body += `**Failed tests:**\n`;
  for (const t of topFails) {
    // Truncate long detail at 120 chars
    const detail = (t.detail ?? "").replace(/\n.*/s, "").slice(0, 120);
    body += `- \`${t.label}\`${detail ? `: ${detail}` : ""}\n`;
  }
  if (failedTests.length > 4) {
    body += `- _…and ${failedTests.length - 4} more_\n`;
  }
  body += `\n`;
}

// Top network failures (max 3)
const topNet = networkFailures.slice(0, 3);
if (topNet.length > 0) {
  body += `**Network failures:**\n`;
  for (const nf of topNet) {
    const url = maskUrl(nf.url ?? "");
    if (nf.type === "requestfailed") {
      body += `- \`${nf.method} ${url}\` → ${nf.failure}\n`;
    } else {
      body += `- \`${nf.method} ${url}\` → HTTP ${nf.status}\n`;
    }
  }
  if (networkFailures.length > 3) {
    body += `- _…and ${networkFailures.length - 3} more_\n`;
  }
  body += `\n`;
}

// Page errors (first line only, max 200 chars)
if (pageErrors && pageErrors !== "(no page errors)") {
  const firstError = pageErrors.split("\n")[0].slice(0, 200);
  body += `**Page error:** \`${firstError}\`\n\n`;
}

body += `<sub>_Automated by [ui-smoke](${runUrl || "#"}) · artifacts retained 7 days_</sub>\n`;

process.stdout.write(body);
