import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const CLI_PATH = path.resolve("scripts/shinen_bundle_summary.mjs");

function runCli(args) {
  return spawnSync(process.execPath, [CLI_PATH, ...args], {
    encoding: "utf8",
  });
}

function writeTempBundle(lines) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bundle-summary-"));
  const file = path.join(dir, "bundle.jsonl");
  fs.writeFileSync(file, lines.join("\n"), "utf8");
  return { dir, file };
}

test("bundle summary aggregates key events/reasons/timeouts", () => {
  const { dir, file } = writeTempBundle([
    JSON.stringify({ kind: "meta", commit: "abcdef1234567890", version: "1.2.3" }),
    JSON.stringify({
      kind: "diag",
      type: "save_guard_applied",
      cardId: 10,
      domain: "x.com",
      link_url: "https://x.com/u/status/1",
      extra: { reasons: ["guard:type8_source", "guard:drop_generic_x_thumb"] },
    }),
    JSON.stringify({ kind: "diag", type: "migration_fix", cardId: 11 }),
    JSON.stringify({
      kind: "diag",
      type: "embed_load_timeout",
      extra: { provider: "x" },
      link_url: "https://x.com/u/status/2",
    }),
    JSON.stringify({
      kind: "diag",
      type: "embed_load_timeout",
      link_url: "https://www.instagram.com/reel/ABC123/",
    }),
  ]);

  try {
    const result = runCli([file]);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /Build: commit=abcdef1 version=1\.2\.3/);
    assert.match(result.stdout, /save_guard_applied: 1/);
    assert.match(result.stdout, /migration_fix: 1/);
    assert.match(result.stdout, /embed_load_timeout: 2/);
    assert.match(result.stdout, /guard:type8_source: 1/);
    assert.match(result.stdout, /guard:drop_generic_x_thumb: 1/);
    assert.match(result.stdout, /x @ x\.com: 1/);
    assert.match(result.stdout, /unknown @ www\.instagram\.com: 1/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("bundle summary tolerates malformed JSONL lines with parseErrors", () => {
  const { dir, file } = writeTempBundle([
    JSON.stringify({ kind: "meta", commit: "abc", version: "0.0.0" }),
    "{not-json",
    JSON.stringify({ kind: "diag", type: "open_click" }),
  ]);

  try {
    const result = runCli([file]);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /ParseErrors: 1/);
    assert.match(result.stdout, /open_click: 1/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("bundle summary exits 2 when no line is parseable as JSON", () => {
  const { dir, file } = writeTempBundle(["not-json", "still-not-json"]);

  try {
    const result = runCli([file]);
    assert.equal(result.status, 2, result.stderr || result.stdout);
    assert.match(result.stdout, /ParsedJSON: 0/);
    assert.match(result.stdout, /ParseErrors: 2/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("bundle summary prints usage and exits 1 when file is missing", () => {
  const result = runCli([]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Usage: node scripts\/shinen_bundle_summary\.mjs <bundle_path>/);
});
