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

const SESSIONS_DIR = path.join(RWL, 'sessions');
const LESSONS_DIR = path.join(RWL, 'lessons');
const ADDON_PATH = path.join(LESSONS_DIR, 'system-addon.txt');
const MAX_LESSONS = 7;

// Ensure dirs exist
[CURRENT, DONE_DIR, QUEUE, LOGS, SESSIONS_DIR, LESSONS_DIR].forEach(d => fs.mkdirSync(d, { recursive: true }));

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

// === Lessons: セッション間学習 ===

/**
 * タスク実行結果をセッションログに記録し、lessonsファイルを更新し、
 * system-addon.txt を再生成する
 */
function recordLesson(taskId, result) {
  // 1. セッションログ（生データ）
  const today = new Date().toISOString().split('T')[0];
  const sessionPath = path.join(SESSIONS_DIR, `${today}.md`);
  const entry = [
    `## ${taskId} — ${result.status}`,
    `Time: ${new Date().toISOString()}`,
    result.status === 'success'
      ? `Completed: ${result.summary || 'no summary'}`
      : `Error: ${result.error || 'unknown'}`,
    '---', ''
  ].join('\n');
  fs.appendFileSync(sessionPath, entry);

  // 2. Lessons更新
  if (result.status === 'error' || result.status === 'blocked') {
    updateLessonsFile(
      path.join(LESSONS_DIR, 'recent-failures.md'),
      `- **${taskId}**: ${result.error || 'unknown'}. 回避策: ${result.workaround || '未特定'}`
    );
  } else if (result.status === 'success') {
    updateLessonsFile(
      path.join(LESSONS_DIR, 'recent-success-patterns.md'),
      `- **${taskId}**: ${result.summary || 'completed'}`
    );
  }

  // 3. system-addon.txt を再生成
  regenerateAddon();
  log({ step: 'lesson_recorded', task_id: taskId, status: result.status });
}

function updateLessonsFile(filePath, newLine) {
  let content = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
  const lines = content.split('\n');
  const headerEnd = lines.findIndex(l => l.includes('<!-- 以下に'));
  const header = headerEnd >= 0 ? lines.slice(0, headerEnd + 1) : lines.slice(0, 4);
  const items = lines.slice(headerEnd >= 0 ? headerEnd + 1 : 4).filter(l => l.startsWith('- '));
  items.push(newLine);
  while (items.length > MAX_LESSONS) items.shift();
  fs.writeFileSync(filePath, [...header, ...items, ''].join('\n'));
}

/**
 * recent-failures.md と recent-success-patterns.md を読み、
 * system-addon.txt に統合する
 */
function regenerateAddon() {
  const preamble = [
    '以下はこのリポジトリで最近確認された失敗/成功パターンです。',
    '失敗パターンの再発を避け、成功パターンを優先してください。',
    '履歴の詳細説明より、再利用可能な作業原則として扱うこと。', ''
  ].join('\n');

  let body = '';
  const failuresPath = path.join(LESSONS_DIR, 'recent-failures.md');
  const successPath = path.join(LESSONS_DIR, 'recent-success-patterns.md');

  if (fs.existsSync(failuresPath)) {
    const items = fs.readFileSync(failuresPath, 'utf8').split('\n').filter(l => l.startsWith('- ')).join('\n');
    if (items) body += `\n## 最近の失敗パターン（再発を避けること）\n${items}\n`;
  }
  if (fs.existsSync(successPath)) {
    const items = fs.readFileSync(successPath, 'utf8').split('\n').filter(l => l.startsWith('- ')).join('\n');
    if (items) body += `\n## 最近の成功パターン（優先して採用すること）\n${items}\n`;
  }

  fs.writeFileSync(ADDON_PATH, body ? preamble + body : '');
}

/**
 * system-addon.txt を読み返す（プロンプト注入用）
 */
function loadLessonsAddon() {
  if (!fs.existsSync(ADDON_PATH)) return '';
  const content = fs.readFileSync(ADDON_PATH, 'utf8').trim();
  return content || '';
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

  // Load lessons addon for prompt injection
  const lessonsAddon = loadLessonsAddon();

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
    ``,
    ...(lessonsAddon ? [`## Lessons from previous runs:`, lessonsAddon] : []),
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
    recordLesson(task.id, { status: 'success', summary: task.goal });
    status.failure_count = 0;
    status.last_task_id = task.id;
  } else {
    recordLesson(task.id, { status: 'error', error: `Task failed (attempt ${(status.failure_count || 0) + 1})` });
    status.failure_count = (status.failure_count || 0) + 1;
    status.last_task_id = task.id;
  }

  writeStatus(status);
}

main();
