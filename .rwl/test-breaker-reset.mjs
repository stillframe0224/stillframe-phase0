#!/usr/bin/env node
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const sourceRunner = fs.readFileSync(new URL('./runner.js', import.meta.url), 'utf8');

function makeFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rwl-breaker-reset-'));
  const rwl = path.join(root, '.rwl');
  const dirs = ['Current', 'Done', 'Quarantine', 'logs'];
  for (const dir of dirs) fs.mkdirSync(path.join(rwl, dir), { recursive: true });
  fs.writeFileSync(path.join(rwl, 'runner.js'), sourceRunner);

  const markerFiles = [
    path.join(rwl, 'Current', 'current-marker.txt'),
    path.join(rwl, 'Done', 'done-marker.txt'),
    path.join(rwl, 'Quarantine', 'quarantine-marker.txt'),
  ];
  for (const file of markerFiles) fs.writeFileSync(file, 'do not touch\n');

  const protectedPaths = [
    path.join(rwl, 'Current'),
    path.join(rwl, 'Done'),
    path.join(rwl, 'Quarantine'),
    ...markerFiles,
  ];

  return { root, rwl, protectedPaths };
}

function statFingerprint(targetPath) {
  const stat = fs.statSync(targetPath);
  return { ino: stat.ino, mtimeMs: stat.mtimeMs };
}

function snapshot(paths) {
  return new Map(paths.map(targetPath => [targetPath, statFingerprint(targetPath)]));
}

function assertUnchanged(before, paths) {
  for (const targetPath of paths) {
    assert.deepEqual(
      statFingerprint(targetPath),
      before.get(targetPath),
      `${targetPath} must not be moved or modified`
    );
  }
}

function runUnblock(rwl, reason) {
  return spawnSync(
    process.execPath,
    [path.join(rwl, 'runner.js'), '--unblock', '--reason', reason],
    { encoding: 'utf8' }
  );
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readJsonl(filePath) {
  return fs.readFileSync(filePath, 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
}

const { rwl, protectedPaths } = makeFixture();
const statusPath = path.join(rwl, 'status.json');
const reason = 'Claude subscription auth restored';

fs.writeFileSync(statusPath, JSON.stringify({
  failure_count: 5,
  max_failures: 5,
  last_run_at: '2026-05-06T13:25:44.069Z',
  last_task_id: '20260319-080000-fix-card-create-error',
  last_task_type: 'lp_improvement',
  last_error: 'execution_failure at attempt 5',
  note: 'previous note',
}, null, 2));

const beforeReset = snapshot(protectedPaths);
const reset = runUnblock(rwl, reason);
assert.equal(reset.status, 0, reset.stderr || reset.stdout);

const resetStatus = readJson(statusPath);
assert.equal(resetStatus.failure_count, 0);
assert.equal(resetStatus.max_failures, 5);
assert.equal(resetStatus.last_error, null);
assert.equal(resetStatus.last_task_id, '20260319-080000-fix-card-create-error');
assert.equal(resetStatus.last_task_type, 'lp_improvement');
assert.equal(resetStatus.note, `breaker reset: ${reason}`);
assertUnchanged(beforeReset, protectedPaths);

const runnerLog = readJsonl(path.join(rwl, 'logs', 'runner.jsonl')).at(-1);
assert.equal(runnerLog.step, 'breaker_reset');
assert.equal(runnerLog.reason, reason);
assert.equal(runnerLog.prev_failure_count, 5);
assert.equal(runnerLog.prev_last_task_id, '20260319-080000-fix-card-create-error');

const eventLog = readJsonl(path.join(rwl, 'EVENTS.jsonl')).at(-1);
assert.equal(eventLog.phase, 'ops');
assert.equal(eventLog.event_type, 'breaker_reset');
assert.equal(eventLog.reason, reason);

const beforeNoop = snapshot(protectedPaths);
const beforeNoopStatus = fs.readFileSync(statusPath, 'utf8');
const noop = runUnblock(rwl, 'second call');
assert.equal(noop.status, 0, noop.stderr || noop.stdout);
assert.match(noop.stdout, /already healthy/);
assert.equal(fs.readFileSync(statusPath, 'utf8'), beforeNoopStatus);
assertUnchanged(beforeNoop, protectedPaths);

console.log('breaker reset test passed');
