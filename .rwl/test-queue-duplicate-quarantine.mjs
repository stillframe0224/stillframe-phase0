#!/usr/bin/env node
/**
 * Test: stale Queue tasks must not be promoted back into Current.
 *
 * The daily check on 2026-05-15 found a task promoted from Queue even after
 * prior manual quarantine/reset work. Queue promotion must skip tasks already
 * represented by DONE.json, Done/, or Quarantine/ and quarantine those stale
 * Queue files instead.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.RWL_RUNNER_SKIP_MAIN = '1';

const { promoteFromQueue } = await import('./runner.js');

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function makeFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rwl-queue-duplicate-'));
  const dirs = {
    root,
    queueDir: path.join(root, 'Queue'),
    currentDir: path.join(root, 'Current'),
    doneDir: path.join(root, 'Done'),
    quarantineDir: path.join(root, 'Quarantine'),
    doneJsonPath: path.join(root, 'DONE.json'),
  };
  for (const dir of [dirs.queueDir, dirs.currentDir, dirs.doneDir, dirs.quarantineDir]) {
    fs.mkdirSync(dir, { recursive: true });
  }
  writeJson(dirs.doneJsonPath, []);
  return dirs;
}

console.log('\n=== stale Queue task already in DONE.json is quarantined ===');
{
  const dirs = makeFixture();
  const logs = [];
  writeJson(dirs.doneJsonPath, [{ id: '20260513-080300-mobile-card-layout-fix' }]);
  writeJson(path.join(dirs.queueDir, '20260513-080300-mobile-card-layout-fix.json'), {
    id: '20260513-080300-mobile-card-layout-fix',
    goal: 'stale task',
  });
  writeJson(path.join(dirs.queueDir, '20260514-080000-fresh.json'), {
    id: '20260514-080000-fresh',
    goal: 'fresh task',
  });

  const promoted = promoteFromQueue({ ...dirs, logFn: entry => logs.push(entry) });

  assert.equal(promoted.id, '20260514-080000-fresh');
  assert.equal(fs.existsSync(path.join(dirs.currentDir, '20260514-080000-fresh.json')), true);
  assert.equal(fs.existsSync(path.join(dirs.queueDir, '20260513-080300-mobile-card-layout-fix.json')), false);
  assert.equal(fs.existsSync(path.join(dirs.quarantineDir, '20260513-080300-mobile-card-layout-fix.json')), true);
  assert.equal(fs.existsSync(path.join(dirs.quarantineDir, '20260513-080300-mobile-card-layout-fix.reason.txt')), true);
  assert.deepEqual(logs.map(l => l.step), ['queue_duplicate_quarantine', 'promote']);
  assert.equal(logs[0].duplicate_source, 'DONE.json');
  console.log('PASS');
}

console.log('\n=== stale Queue task already in Quarantine is not promoted ===');
{
  const dirs = makeFixture();
  const logs = [];
  writeJson(path.join(dirs.quarantineDir, 'older-name.json'), {
    id: 'duplicate-by-id',
    goal: 'already quarantined',
  });
  writeJson(path.join(dirs.queueDir, 'duplicate-by-id.json'), {
    id: 'duplicate-by-id',
    goal: 'stale task',
  });

  const promoted = promoteFromQueue({ ...dirs, logFn: entry => logs.push(entry) });

  assert.equal(promoted, null);
  assert.equal(fs.readdirSync(dirs.currentDir).length, 0);
  assert.equal(fs.existsSync(path.join(dirs.queueDir, 'duplicate-by-id.json')), false);
  assert.equal(fs.existsSync(path.join(dirs.quarantineDir, 'duplicate-by-id.json')), true);
  assert.equal(logs.length, 1);
  assert.equal(logs[0].step, 'queue_duplicate_quarantine');
  assert.equal(logs[0].duplicate_source, 'Quarantine');
  assert.equal(logs[0].duplicate_match, 'id');
  console.log('PASS');
}

console.log('\n=== ALL TESTS PASSED ===\n');
