#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";

const FIXED_EVENT_ORDER = [
  "save_guard_applied",
  "migration_start",
  "migration_fix",
  "migration_action_enqueued",
  "migration_done",
  "embed_load_start",
  "embed_load_ok",
  "embed_load_timeout",
  "thumb_error",
  "open_click",
];

function usage() {
  return "Usage: node scripts/shinen_bundle_summary.mjs <bundle_path>";
}

function shortCommit(value) {
  if (!value) return "unknown";
  const raw = String(value).trim();
  if (!raw) return "unknown";
  return /^[0-9a-f]{8,}$/i.test(raw) ? raw.slice(0, 7) : raw;
}

function safeParseUrlHost(url) {
  if (!url || typeof url !== "string") return null;
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function readNested(obj, pathParts) {
  let current = obj;
  for (const part of pathParts) {
    if (!current || typeof current !== "object") return null;
    current = current[part];
  }
  return current ?? null;
}

function toKey(value, fallback = "unknown") {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed || fallback;
}

function extractProvider(row) {
  return toKey(
    row?.provider ??
      readNested(row, ["extra", "provider"]) ??
      readNested(row, ["extra", "cardSnapshot", "provider"]),
    "unknown",
  );
}

function extractDomain(row) {
  const direct =
    row?.domain ??
    readNested(row, ["extra", "domain"]) ??
    readNested(row, ["extra", "cardSnapshot", "domain"]);
  if (typeof direct === "string" && direct.trim()) return direct.trim().toLowerCase();

  const fromUrl =
    safeParseUrlHost(row?.link_url) ??
    safeParseUrlHost(readNested(row, ["extra", "link_url"])) ??
    safeParseUrlHost(readNested(row, ["extra", "cardSnapshot", "link_url"])) ??
    safeParseUrlHost(readNested(row, ["extra", "embedUrl"]));
  return fromUrl ?? "unknown";
}

function inc(map, key, by = 1) {
  map.set(key, (map.get(key) ?? 0) + by);
}

function sortedEntries(map) {
  return [...map.entries()].sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return String(a[0]).localeCompare(String(b[0]));
  });
}

function printTopSection(title, map, formatter = (k, v) => `${k}: ${v}`, max = 8) {
  console.log(`${title}:`);
  const entries = sortedEntries(map).slice(0, max);
  if (entries.length === 0) {
    console.log("  (none)");
    return;
  }
  for (const [key, value] of entries) {
    console.log(`  ${formatter(key, value)}`);
  }
}

async function summarizeBundle(filePath) {
  const resolved = path.resolve(filePath);
  const stream = fs.createReadStream(resolved, { encoding: "utf8" });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  let totalLines = 0;
  let parsedLines = 0;
  let parseErrors = 0;
  let firstMeta = null;

  const eventCounts = new Map();
  const saveGuardReasons = new Map();
  const embedTimeoutByProviderDomain = new Map();

  for await (const line of rl) {
    totalLines += 1;
    const trimmed = line.trim();
    if (!trimmed) continue;

    let row;
    try {
      row = JSON.parse(trimmed);
    } catch {
      parseErrors += 1;
      continue;
    }
    parsedLines += 1;

    if (!firstMeta && row?.kind === "meta" && typeof row === "object") {
      firstMeta = row;
    }
    if (!row || row.kind !== "diag") continue;

    const type = toKey(row.type, "unknown");
    inc(eventCounts, type);

    if (type === "save_guard_applied") {
      const reasons = readNested(row, ["extra", "reasons"]);
      if (Array.isArray(reasons)) {
        for (const reason of reasons) {
          inc(saveGuardReasons, toKey(reason, "unknown"));
        }
      }
    }
    if (type === "embed_load_timeout") {
      const provider = extractProvider(row);
      const domain = extractDomain(row);
      inc(embedTimeoutByProviderDomain, `${provider} @ ${domain}`);
    }
  }

  const commit = shortCommit(firstMeta?.commit ?? firstMeta?.sha);
  const version = toKey(firstMeta?.version, "unknown");

  console.log("=== SHINEN Bundle Summary ===");
  console.log(`File: ${resolved}`);
  console.log(`Lines: ${totalLines}`);
  console.log(`ParseErrors: ${parseErrors}`);
  console.log(`ParsedJSON: ${parsedLines}`);
  console.log(`Build: commit=${commit} version=${version}`);
  console.log("");
  console.log("EventCounts:");

  let knownTotal = 0;
  for (const eventName of FIXED_EVENT_ORDER) {
    const count = eventCounts.get(eventName) ?? 0;
    knownTotal += count;
    console.log(`  ${eventName}: ${count}`);
  }
  const totalEvents = sortedEntries(eventCounts).reduce((sum, [, value]) => sum + value, 0);
  const otherEvents = Math.max(0, totalEvents - knownTotal);
  console.log(`  other: ${otherEvents}`);
  if (otherEvents > 0) {
    const fixedSet = new Set(FIXED_EVENT_ORDER);
    const otherMap = new Map([...eventCounts.entries()].filter(([key]) => !fixedSet.has(key)));
    for (const [eventName, count] of sortedEntries(otherMap)) {
      console.log(`    ${eventName}: ${count}`);
    }
  }

  console.log("");
  printTopSection("TopSaveGuardReasons", saveGuardReasons);
  console.log("");
  printTopSection("TopEmbedTimeouts", embedTimeoutByProviderDomain);

  if (parsedLines === 0) {
    process.exitCode = 2;
    return;
  }
  process.exitCode = 0;
}

async function main() {
  const inputPath = process.argv[2];
  if (!inputPath) {
    console.error(usage());
    process.exit(1);
  }
  const resolved = path.resolve(inputPath);
  try {
    await fs.promises.access(resolved, fs.constants.R_OK);
  } catch {
    console.error(usage());
    console.error(`Error: cannot read file '${resolved}'`);
    process.exit(1);
  }
  await summarizeBundle(resolved);
}

main().catch((error) => {
  console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
