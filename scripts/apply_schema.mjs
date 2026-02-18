#!/usr/bin/env node
/**
 * apply_schema.mjs — Supabase schema verification + apply guidance
 *
 * Usage:
 *   node scripts/apply_schema.mjs
 *   BASE_URL=https://stillframe-phase0.vercel.app node scripts/apply_schema.mjs
 *
 * What it does:
 *   1. GET /api/db-schema-check → checks which columns are present
 *   2. If all required columns present → exit 0  ✅
 *   3. If any missing → print the SQL to apply + exit 1  ❌
 *
 * Why not auto-apply?
 *   The anon key has no DDL privileges. The service role key is not stored
 *   in .env.local (intentionally — it must never be checked into source).
 *   The SQL is idempotent (IF NOT EXISTS) — safe to run multiple times.
 *
 * SQL location: supabase/sql/cards_notes_setup.sql
 *               supabase/sql/cards_media_setup.sql
 */

import { readFileSync } from "fs";
import { resolve } from "path";

const BASE_URL = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const ENDPOINT = `${BASE_URL}/api/db-schema-check`;

const SQL_FILES = {
  notes: resolve("supabase/sql/cards_notes_setup.sql"),
  media_kind: resolve("supabase/sql/cards_media_setup.sql"),
};

function printSection(title, content) {
  console.log(`\n${"─".repeat(60)}`);
  console.log(title);
  console.log("─".repeat(60));
  console.log(content);
}

async function main() {
  console.log(`\n=== apply_schema ===`);
  console.log(`Endpoint: ${ENDPOINT}`);
  console.log(`Started:  ${new Date().toISOString()}\n`);

  let result;
  try {
    const res = await fetch(ENDPOINT, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) {
      console.error(`[ERROR] /api/db-schema-check returned HTTP ${res.status}`);
      const body = await res.text().catch(() => "");
      if (body) console.error(`        ${body}`);
      process.exit(1);
    }
    result = await res.json();
  } catch (e) {
    console.error(`[ERROR] Failed to reach ${ENDPOINT}: ${e.message}`);
    console.error(`        Make sure the server is running (npm run dev or npm start).`);
    process.exit(1);
  }

  const { ok, columns, error: apiError } = result;

  if (apiError) {
    console.error(`[ERROR] API reported: ${apiError}`);
    process.exit(1);
  }

  // Print status for each column
  const REQUIRED = ["notes", "media_kind"];
  const missing = [];

  for (const col of REQUIRED) {
    const present = columns?.[col] ?? false;
    const status = present ? "✅ PRESENT" : "❌ MISSING";
    console.log(`  cards.${col.padEnd(12)} ${status}`);
    if (!present) missing.push(col);
  }

  if (ok && missing.length === 0) {
    console.log(`\n✅ All required columns are present. No action needed.`);
    process.exit(0);
  }

  // ── Some columns missing ──────────────────────────────────────────────────
  console.log(`\n❌ Missing ${missing.length} column(s): ${missing.join(", ")}`);
  console.log(`\nTo fix, run the following SQL in the Supabase SQL Editor:`);
  console.log(`  Dashboard → https://supabase.com/dashboard → SQL Editor → New query`);

  for (const col of missing) {
    const sqlFile = SQL_FILES[col];
    if (!sqlFile) continue;
    let sql = "";
    try {
      sql = readFileSync(sqlFile, "utf8");
    } catch {
      sql = `-- Could not read ${sqlFile}`;
    }
    printSection(`SQL for: cards.${col}  (${sqlFile})`, sql);
  }

  console.log(`\n${"─".repeat(60)}`);
  console.log(`After applying, re-run this script to verify:`);
  console.log(`  node scripts/apply_schema.mjs`);
  console.log(`${"─".repeat(60)}\n`);

  process.exit(1);
}

main().catch((e) => {
  console.error("[FATAL]", e);
  process.exit(1);
});
