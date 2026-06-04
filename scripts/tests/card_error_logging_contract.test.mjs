import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../..");

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

test("card Supabase failures are persisted through error_logs", () => {
  const src = read("app/app/shinen/lib/supabase-cards.ts");

  assert.match(src, /logCardError/);
  assert.match(src, /supabase_insert_card_auth_failed/);
  assert.match(src, /supabase_insert_card_failed/);
  assert.match(src, /cardTextLength/);
  assert.doesNotMatch(src, /cardText:/);
});

test("OGP fetch failures are persisted without raw URL context", () => {
  const src = read("app/app/shinen/hooks/useOgThumbnails.ts");
  const logBlock = src.slice(
    src.indexOf('source: "og_fetch_failed"'),
    src.indexOf("});", src.indexOf('source: "og_fetch_failed"')),
  );

  assert.match(src, /source:\s*"og_fetch_failed"/);
  assert.match(logBlock, /domain:\s*getHostname\(url\)/);
  assert.doesNotMatch(logBlock, /url:/);
});

test("error_logs migration creates RLS-protected insert storage", () => {
  const migration = read("supabase/migrations/005_error_logs.sql");

  assert.match(migration, /create table if not exists public\.error_logs/);
  assert.match(migration, /alter table if exists public\.error_logs enable row level security/);
  assert.match(migration, /for insert/);
  assert.match(migration, /auth\.uid\(\) = user_id or user_id is null/);
});
