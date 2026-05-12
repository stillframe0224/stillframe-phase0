#!/usr/bin/env node
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const sourceRunner = fs.readFileSync(new URL('./runner.js', import.meta.url), 'utf8');
const taskId = '20260506-080400-typescript-errors';
const reason = 'non-Kizuki SHINEN task held while RWL is idle-only';
const taskJson = JSON.stringify({ id: taskId, goal: 'TypeScript型エラーを解消' }, null, 2);

function makeFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rwl-dequeue-'));
  const rwl = path.join(root, '.rwl');
  for (const dir of ['Queue', 'Holding', 'logs']) {
    fs.mkdirSync(path.join(rwl, dir), { recursive: true });
  }
  fs.writeFileSync(path.join(rwl, 'runner.js'), sourceRunner);
  return { root, rwl };
}

function runDequeue(rwl, id = taskId) {
  return spawnSync(
    process.execPath,
    [path.join(rwl, 'runner.js'), '--dequeue', id, '--reason', reason],
    { encoding: 'utf8' }
  );
}

function readJsonl(filePath) {
  return fs.readFileSync(filePath, 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
}

function assertLastAudit(rwl, mode) {
  const runnerLog = readJsonl(path.join(rwl, 'logs', 'runner.jsonl')).at(-1);
  assert.equal(runnerLog.step, 'dequeued');
  assert.equal(runnerLog.task_id, taskId);
  assert.equal(runnerLog.reason, reason);
  assert.equal(runnerLog.mode, mode);

  const eventLog = readJsonl(path.join(rwl, 'EVENTS.jsonl')).at(-1);
  assert.equal(eventLog.phase, 'ops');
  assert.equal(eventLog.event_type, 'dequeued');
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
  const result = runDequeue(rwl);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /no queued task/);
  assert.equal(fs.existsSync(path.join(rwl, 'logs', 'runner.jsonl')), false);
  assert.equal(fs.existsSync(path.join(rwl, 'EVENTS.jsonl')), false);
}

{
  const { rwl } = makeFixture();
  fs.writeFileSync(path.join(rwl, 'Queue', `${taskId}.json`), taskJson);

  const result = runDequeue(rwl);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(fs.existsSync(path.join(rwl, 'Queue', `${taskId}.json`)), false);
  assert.equal(fs.readFileSync(path.join(rwl, 'Holding', `${taskId}.json`), 'utf8'), taskJson);
  assert.match(fs.readFileSync(path.join(rwl, 'Holding', `${taskId}.reason.txt`), 'utf8'), /blocked_reason: non-Kizuki SHINEN task held/);
  assertLastAudit(rwl, 'new');
}

{
  const { rwl } = makeFixture();
  fs.writeFileSync(path.join(rwl, 'Queue', `${taskId}.json`), taskJson);
  fs.writeFileSync(path.join(rwl, 'Holding', `${taskId}.json`), taskJson);
  fs.writeFileSync(path.join(rwl, 'Holding', `${taskId}.reason.txt`), 'existing reason\n');
  const holdingBefore = statFingerprint(path.join(rwl, 'Holding', `${taskId}.json`));

  const result = runDequeue(rwl);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(fs.existsSync(path.join(rwl, 'Queue', `${taskId}.json`)), false);
  assert.deepEqual(statFingerprint(path.join(rwl, 'Holding', `${taskId}.json`)), holdingBefore);
  const reasonText = fs.readFileSync(path.join(rwl, 'Holding', `${taskId}.reason.txt`), 'utf8');
  assert.match(reasonText, /existing reason/);
  assert.match(reasonText, /ops_append: .* non-Kizuki SHINEN task held/);
  assertLastAudit(rwl, 'append');
}

{
  const { rwl } = makeFixture();
  fs.writeFileSync(path.join(rwl, 'Queue', `${taskId}.json`), taskJson);
  fs.writeFileSync(path.join(rwl, 'Holding', `${taskId}.json`), JSON.stringify({ id: taskId, goal: 'different' }, null, 2));
  fs.writeFileSync(path.join(rwl, 'Holding', `${taskId}.reason.txt`), 'existing reason\n');

  const result = runDequeue(rwl);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(fs.existsSync(path.join(rwl, 'Queue', `${taskId}.json`)), false);
  assert.equal(fs.readFileSync(path.join(rwl, 'Holding', `${taskId}.json`), 'utf8'), JSON.stringify({ id: taskId, goal: 'different' }, null, 2));

  const timestampedJson = fs.readdirSync(path.join(rwl, 'Holding'))
    .filter(file => file !== `${taskId}.json` && file.startsWith(`${taskId}.`) && file.endsWith('.json'));
  assert.equal(timestampedJson.length, 1);
  const timestampedReason = timestampedJson[0].replace(/\.json$/, '.reason.txt');
  assert.equal(fs.readFileSync(path.join(rwl, 'Holding', timestampedJson[0]), 'utf8'), taskJson);
  assert.match(fs.readFileSync(path.join(rwl, 'Holding', timestampedReason), 'utf8'), /blocked_reason: non-Kizuki SHINEN task held/);
  assertLastAudit(rwl, 'timestamped');
}

console.log('dequeue test passed');
