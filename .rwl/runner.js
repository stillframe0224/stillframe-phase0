#!/usr/bin/env node
/**
 * RWL Runner — Minimal task executor for SHINEN
 * 
 * Reads Current/ task, runs Claude Code to execute it,
 * and moves to Done/ on success or increments failure on error.
 * 
 * Called by run.sh with --max_loops 1
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT = path.resolve(__dirname, '..');
const RWL = path.join(ROOT, '.rwl');
const CURRENT = path.join(RWL, 'Current');
const DONE_DIR = path.join(RWL, 'Done');
const QUEUE = path.join(RWL, 'Queue');
const DONE_JSON = path.join(RWL, 'DONE.json');
const STATUS = path.join(RWL, 'status.json');
const LOGS = path.join(RWL, 'logs');

// Ensure dirs exist
[CURRENT, DONE_DIR, QUEUE, LOGS].forEach(d => fs.mkdirSync(d, { recursive: true }));

function log(msg) {
  const entry = { ts: new Date().toISOString(), ...msg };
  fs.appendFileSync(path.join(LOGS, 'runner.jsonl'), JSON.stringify(entry) + '\n');
  console.log(JSON.stringify(entry));
}

function readStatus() {
  try {
    return JSON.parse(fs.readFileSync(STATUS, 'utf8'));
  } catch {
    return { failure_count: 0, max_failures: 5 };
  }
}

function writeStatus(s) {
  s.last_run_at = new Date().toISOString();
  fs.writeFileSync(STATUS, JSON.stringify(s, null, 2));
}

function getCurrentTask() {
  const files = fs.readdirSync(CURRENT).filter(f => f.endsWith('.json'));
  if (files.length === 0) return null;
  const content = JSON.parse(fs.readFileSync(path.join(CURRENT, files[0]), 'utf8'));
  content._filename = files[0];
  return content;
}

function promoteFromQueue() {
  const files = fs.readdirSync(QUEUE).filter(f => f.endsWith('.json')).sort();
  if (files.length === 0) return null;
  const src = path.join(QUEUE, files[0]);
  const dst = path.join(CURRENT, files[0]);
  fs.renameSync(src, dst);
  const content = JSON.parse(fs.readFileSync(dst, 'utf8'));
  content._filename = files[0];
  content.status = 'current';
  fs.writeFileSync(dst, JSON.stringify(content, null, 2));
  log({ step: 'promote', task_id: content.id, from: 'Queue' });
  return content;
}

function markDone(task) {
  const src = path.join(CURRENT, task._filename);
  const dst = path.join(DONE_DIR, task._filename);

  // Update task file
  task.status = 'done';
  task.completed_at = new Date().toISOString();
  fs.writeFileSync(src, JSON.stringify(task, null, 2));
  fs.renameSync(src, dst);

  // Append to DONE.json
  let doneList = [];
  try { doneList = JSON.parse(fs.readFileSync(DONE_JSON, 'utf8')); } catch {}
  if (!Array.isArray(doneList)) doneList = [];
  doneList.push({
    id: task.id,
    goal: task.goal,
    completed_at: task.completed_at,
    session: 'nightly'
  });
  fs.writeFileSync(DONE_JSON, JSON.stringify(doneList, null, 2));

  log({ step: 'done', task_id: task.id });
}

function executeTask(task) {
  log({ step: 'execute_start', task_id: task.id, goal: task.goal });

  // Build the Claude Code prompt from the task
  const prompt = [
    `You are working on SHINEN (stillframe-phase0).`,
    `Read CLAUDE.md for project context.`,
    ``,
    `## Task: ${task.goal}`,
    ``,
    `## Definition of Done:`,
    ...(task.dod || []).map(d => `- ${d}`),
    ``,
    `## Rules:`,
    `- Work in a feature branch: git checkout -b rwl/${task.id}`,
    `- Make minimal, focused changes`,
    `- Run npm run build — must pass with zero errors`,
    `- Create a PR to main`,
    `- Do NOT merge the PR`,
  ].join('\n');

  try {
    // Try to use claude-code CLI
    const result = execSync(
      `cd "${ROOT}" && claude -p "${prompt}" --max-turns 20 --output-format text`,
      {
        encoding: 'utf8',
        timeout: 240000, // 4 minutes (run.sh has 5 min timeout)
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, PATH: '/usr/local/bin:/opt/homebrew/bin:' + process.env.PATH }
      }
    );

    log({ step: 'execute_end', task_id: task.id, status: 'ok', output_length: result.length });
    return true;
  } catch (err) {
    log({ step: 'execute_end', task_id: task.id, status: 'error', error: err.message?.slice(0, 500) });
    return false;
  }
}

// Main
function main() {
  const status = readStatus();

  // Check breaker
  if (status.failure_count >= (status.max_failures || 5)) {
    log({ step: 'breaker_stop', failure_count: status.failure_count });
    process.exit(0);
  }

  // Get or promote task
  let task = getCurrentTask();
  if (!task) {
    task = promoteFromQueue();
  }
  if (!task) {
    log({ step: 'idle', reason: 'no_tasks' });
    process.exit(0);
  }

  // Execute
  const success = executeTask(task);

  if (success) {
    markDone(task);
    status.failure_count = 0;
    status.last_task_id = task.id;
  } else {
    status.failure_count = (status.failure_count || 0) + 1;
    status.last_task_id = task.id;
  }

  writeStatus(status);
}

main();
