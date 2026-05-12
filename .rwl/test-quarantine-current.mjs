#!/usr/bin/env node
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const sourceRunner = fs.readFileSync(new URL('./runner.js', import.meta.url), 'utf8');
const taskId = '20260319-080000-fix-card-create-error';
const reason = 'auth-cli outage recurrence';
const taskJson = JSON.stringify({ id: taskId, goal: 'already handled' }, null, 2);

function makeFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rwl-quarantine-current-'));
  const rwl = path.join(root, '.rwl');
  for (const dir of ['Current', 'Done', 'Quarantine', 'logs']) {
    fs.mkdirSync(path.join(rwl, dir), { recursive: true });
  }
  fs.writeFileSync(path.join(rwl, 'runner.js'), sourceRunner);
  fs.writeFileSync(path.join(rwl, 'Done', `${taskId}.json`), taskJson);
  return { root, rwl };
}

function runQuarantine(rwl, id = taskId) {
  return spawnSync(
    process.execPath,
    [path.join(rwl, 'runner.js'), '--quarantine-current', id, '--reason', reason],
    { encoding: 'utf8' }
  );
}

function readJsonl(filePath) {
  return fs.readFileSync(filePath, 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
}

function assertLastAudit(rwl, mode) {
  const runnerLog = readJsonl(path.join(rwl, 'logs', 'runner.jsonl')).at(-1);
  assert.equal(runnerLog.step, 'current_quarantined');
  assert.equal(runnerLog.task_id, taskId);
  assert.equal(runnerLog.reason, reason);
  assert.equal(runnerLog.mode, mode);

  const eventLog = readJsonl(path.join(rwl, 'EVENTS.jsonl')).at(-1);
  assert.equal(eventLog.phase, 'ops');
  assert.equal(eventLog.event_type, 'current_quarantined');
  assert.equal(eventLog.task_id, taskId);
  assert.equal(eventLog.reason, reason);
  assert.equal(eventLog.mode, mode);
}

function statFingerprint(targetPath) {
  const stat = fs.statSync(targetPath);
  return { ino: stat.ino, mtimeMs: stat.mtimeMs, size: stat.size };
}

{
  const { rwl } = makeFixture();
  const result = runQuarantine(rwl);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /no current task/);
  assert.equal(fs.existsSync(path.join(rwl, 'logs', 'runner.jsonl')), false);
  assert.equal(fs.existsSync(path.join(rwl, 'EVENTS.jsonl')), false);
}

{
  const { rwl } = makeFixture();
  fs.writeFileSync(path.join(rwl, 'Current', `${taskId}.json`), taskJson);
  const doneBefore = statFingerprint(path.join(rwl, 'Done', `${taskId}.json`));

  const result = runQuarantine(rwl);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(fs.existsSync(path.join(rwl, 'Current', `${taskId}.json`)), false);
  assert.equal(fs.readFileSync(path.join(rwl, 'Quarantine', `${taskId}.json`), 'utf8'), taskJson);
  assert.match(fs.readFileSync(path.join(rwl, 'Quarantine', `${taskId}.reason.txt`), 'utf8'), /blocked_reason: auth-cli outage recurrence/);
  assert.deepEqual(statFingerprint(path.join(rwl, 'Done', `${taskId}.json`)), doneBefore);
  assertLastAudit(rwl, 'new');
}

{
  const { rwl } = makeFixture();
  fs.writeFileSync(path.join(rwl, 'Current', `${taskId}.json`), taskJson);
  fs.writeFileSync(path.join(rwl, 'Quarantine', `${taskId}.json`), taskJson);
  fs.writeFileSync(path.join(rwl, 'Quarantine', `${taskId}.reason.txt`), 'existing reason\n');
  const quarantineBefore = statFingerprint(path.join(rwl, 'Quarantine', `${taskId}.json`));

  const result = runQuarantine(rwl);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(fs.existsSync(path.join(rwl, 'Current', `${taskId}.json`)), false);
  assert.deepEqual(statFingerprint(path.join(rwl, 'Quarantine', `${taskId}.json`)), quarantineBefore);
  const reasonText = fs.readFileSync(path.join(rwl, 'Quarantine', `${taskId}.reason.txt`), 'utf8');
  assert.match(reasonText, /existing reason/);
  assert.match(reasonText, /ops_append: .* auth-cli outage recurrence/);
  assertLastAudit(rwl, 'append');
}

{
  const { rwl } = makeFixture();
  fs.writeFileSync(path.join(rwl, 'Current', `${taskId}.json`), taskJson);
  fs.writeFileSync(path.join(rwl, 'Quarantine', `${taskId}.json`), JSON.stringify({ id: taskId, goal: 'different' }, null, 2));
  fs.writeFileSync(path.join(rwl, 'Quarantine', `${taskId}.reason.txt`), 'existing reason\n');

  const result = runQuarantine(rwl);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(fs.existsSync(path.join(rwl, 'Current', `${taskId}.json`)), false);
  assert.equal(fs.readFileSync(path.join(rwl, 'Quarantine', `${taskId}.json`), 'utf8'), JSON.stringify({ id: taskId, goal: 'different' }, null, 2));

  const timestampedJson = fs.readdirSync(path.join(rwl, 'Quarantine'))
    .filter(file => file !== `${taskId}.json` && file.startsWith(`${taskId}.`) && file.endsWith('.json'));
  assert.equal(timestampedJson.length, 1);
  const timestampedReason = timestampedJson[0].replace(/\.json$/, '.reason.txt');
  assert.equal(fs.readFileSync(path.join(rwl, 'Quarantine', timestampedJson[0]), 'utf8'), taskJson);
  assert.match(fs.readFileSync(path.join(rwl, 'Quarantine', timestampedReason), 'utf8'), /blocked_reason: auth-cli outage recurrence/);
  assertLastAudit(rwl, 'timestamped');
}

console.log('quarantine current test passed');
