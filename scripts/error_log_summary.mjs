#!/usr/bin/env node

/**
 * Error Log Aggregation Script
 *
 * Parses structured JSON error logs produced by lib/supabase/logger.ts
 * and outputs aggregated summaries by category, operation, and level.
 *
 * Usage:
 *   # From a log file (e.g. exported from Vercel Function Logs):
 *   node scripts/error_log_summary.mjs <logfile.jsonl>
 *
 *   # From stdin (e.g. piped from vercel logs):
 *   vercel logs --output json | node scripts/error_log_summary.mjs
 *
 * Schema note:
 *   No error_logs table exists in Supabase. Errors are logged to
 *   console.error as JSON and captured by Vercel Function Logs.
 *   Expected line format (from lib/supabase/logger.ts):
 *     {"level":"error","category":"auth","operation":"getUser","message":"...","timestamp":"..."}
 */

import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";

function usage() {
  return [
    "Usage: node scripts/error_log_summary.mjs [logfile.jsonl]",
    "",
    "  Reads structured JSON error logs from a file or stdin.",
    "  Outputs aggregated summary by category, operation, and level.",
  ].join("\n");
}

function inc(map, key) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function sortedEntries(map) {
  return [...map.entries()].sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return String(a[0]).localeCompare(String(b[0]));
  });
}

function printSection(title, map, max = 20) {
  console.log(`${title}:`);
  const entries = sortedEntries(map).slice(0, max);
  if (entries.length === 0) {
    console.log("  (none)");
    return;
  }
  for (const [key, value] of entries) {
    console.log(`  ${key}: ${value}`);
  }
}

function isLogEntry(obj) {
  return (
    obj &&
    typeof obj === "object" &&
    typeof obj.level === "string" &&
    typeof obj.category === "string" &&
    typeof obj.operation === "string"
  );
}

function tryExtractLogEntry(line) {
  const trimmed = line.trim();
  if (!trimmed) return null;

  // Direct JSON line
  try {
    const parsed = JSON.parse(trimmed);
    if (isLogEntry(parsed)) return parsed;

    // Vercel log wrapper: { "message": "{\"level\":...}" }
    if (typeof parsed.message === "string") {
      try {
        const inner = JSON.parse(parsed.message);
        if (isLogEntry(inner)) return inner;
      } catch {
        // not a nested JSON message
      }
    }
  } catch {
    // not JSON
  }

  return null;
}

async function summarize(input) {
  const rl = readline.createInterface({ input, crlfDelay: Infinity });

  let totalLines = 0;
  let matchedLines = 0;

  const byCategory = new Map();
  const byOperation = new Map();
  const byLevel = new Map();
  const byCategoryOp = new Map();
  const byCode = new Map();
  const recentErrors = [];
  let timeMin = null;
  let timeMax = null;

  for await (const line of rl) {
    totalLines += 1;
    const entry = tryExtractLogEntry(line);
    if (!entry) continue;

    matchedLines += 1;
    inc(byCategory, entry.category);
    inc(byOperation, entry.operation);
    inc(byLevel, entry.level);
    inc(byCategoryOp, `${entry.category}/${entry.operation}`);

    if (entry.code) {
      inc(byCode, entry.code);
    }

    if (entry.timestamp) {
      if (!timeMin || entry.timestamp < timeMin) timeMin = entry.timestamp;
      if (!timeMax || entry.timestamp > timeMax) timeMax = entry.timestamp;
    }

    if (entry.level === "error" && recentErrors.length < 5) {
      recentErrors.push({
        category: entry.category,
        operation: entry.operation,
        message: entry.message?.slice(0, 120),
        timestamp: entry.timestamp,
      });
    }
  }

  // Output
  console.log("=== Error Log Summary ===");
  console.log(`Total lines scanned: ${totalLines}`);
  console.log(`Log entries matched: ${matchedLines}`);
  if (timeMin && timeMax) {
    console.log(`Time range: ${timeMin} → ${timeMax}`);
  }
  console.log("");

  printSection("By Level", byLevel);
  console.log("");
  printSection("By Category", byCategory);
  console.log("");
  printSection("By Operation", byOperation);
  console.log("");
  printSection("By Category/Operation", byCategoryOp);

  if (byCode.size > 0) {
    console.log("");
    printSection("By Error Code", byCode);
  }

  if (recentErrors.length > 0) {
    console.log("");
    console.log("Recent Errors (up to 5):");
    for (const e of recentErrors) {
      console.log(`  [${e.timestamp ?? "?"}] ${e.category}/${e.operation}: ${e.message}`);
    }
  }

  if (matchedLines === 0) {
    console.log("");
    console.log("No structured log entries found.");
    console.log("Expected JSON format: {\"level\":\"error\",\"category\":\"...\",\"operation\":\"...\",\"message\":\"...\"}");
    process.exitCode = 2;
    return;
  }

  process.exitCode = 0;
}

async function main() {
  const inputPath = process.argv[2];

  if (inputPath === "--help" || inputPath === "-h") {
    console.log(usage());
    process.exit(0);
  }

  let input;
  if (inputPath) {
    const resolved = path.resolve(inputPath);
    try {
      await fs.promises.access(resolved, fs.constants.R_OK);
    } catch {
      console.error(usage());
      console.error(`Error: cannot read file '${resolved}'`);
      process.exit(1);
    }
    input = fs.createReadStream(resolved, { encoding: "utf8" });
  } else if (!process.stdin.isTTY) {
    input = process.stdin;
  } else {
    console.error(usage());
    process.exit(1);
  }

  await summarize(input);
}

main().catch((error) => {
  console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
