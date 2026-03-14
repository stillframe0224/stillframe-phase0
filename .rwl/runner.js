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
const EVENTS_JSONL = path.join(RWL, 'EVENTS.jsonl');
const POSTMORTEMS_DIR = path.join(RWL, 'postmortems');
const ANTI_PATTERNS_JSON = path.join(RWL, 'anti-patterns.json');

// Ensure dirs exist
[CURRENT, DONE_DIR, QUEUE, LOGS, POSTMORTEMS_DIR].forEach(d => fs.mkdirSync(d, { recursive: true }));

function log(msg) {
  const entry = { ts: new Date().toISOString(), ...msg };
  fs.appendFileSync(path.join(LOGS, 'runner.jsonl'), JSON.stringify(entry) + '\n');
  console.log(JSON.stringify(entry));
}

function logEvent(runId, event) {
  const entry = {
    ts: new Date().toISOString(),
    run_id: runId,
    ...event
  };
  fs.appendFileSync(EVENTS_JSONL, JSON.stringify(entry) + '\n');
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

function classifyError(err) {
  const msg = (err.message || err.stderr || String(err)).slice(0, 1000);
  const lower = msg.toLowerCase();

  let category = 'unknown';
  let hypothesis = 'Unknown failure';
  let preventive = 'Investigate manually';

  if (lower.includes('timeout') || lower.includes('etimedout')) {
    category = 'timeout';
    hypothesis = 'Task exceeded 4-minute execution limit';
    preventive = 'Break task into smaller subtasks or increase timeout';
  } else if (lower.includes('build') && (lower.includes('fail') || lower.includes('error'))) {
    category = 'build_fail';
    hypothesis = 'Code changes broke the build';
    preventive = 'Add build check assertion to task dod';
  } else if (lower.includes('merge conflict') || lower.includes('conflict')) {
    category = 'git_conflict';
    hypothesis = 'Branch diverged from main';
    preventive = 'Rebase before starting task';
  } else if (lower.includes('rate limit') || lower.includes('429')) {
    category = 'rate_limit';
    hypothesis = 'API rate limit hit';
    preventive = 'Add backoff or reduce max-turns';
  } else if (lower.includes('enospc') || lower.includes('no space')) {
    category = 'disk_full';
    hypothesis = 'Disk space exhausted';
    preventive = 'Clean up before nightly run';
  } else if (lower.includes('auth') || lower.includes('401') || lower.includes('403')) {
    category = 'auth';
    hypothesis = 'Authentication or permission failure';
    preventive = 'Verify API keys and permissions before run';
  }

  return {
    category,
    message: msg.slice(0, 300),
    retryable: ['timeout', 'rate_limit', 'build_fail'].includes(category),
    hypothesis,
    preventive
  };
}

function writePostmortem(task, errorInfo) {
  let branch = '';
  try { branch = execSync(`git -C "${ROOT}" rev-parse --abbrev-ref HEAD`, { encoding: 'utf8', timeout: 5000 }).trim(); } catch {}
  let queueCount = 0;
  try { queueCount = fs.readdirSync(QUEUE).filter(f => f.endsWith('.json')).length; } catch {}

  const postmortem = {
    task_id: task.id,
    goal: task.goal,
    failed_at: new Date().toISOString(),
    error_tag: errorInfo.category,
    failure_class: errorInfo.category,
    symptom: errorInfo.message,
    root_cause_hypothesis: errorInfo.hypothesis,
    preventive_rule_candidate: errorInfo.preventive,
    context_snapshot: { branch, queue_count: queueCount }
  };

  const filename = `${task.id}_${Date.now()}.json`;
  fs.writeFileSync(path.join(POSTMORTEMS_DIR, filename), JSON.stringify(postmortem, null, 2));

  return postmortem;
}

function preflight(task, runId) {
  let patterns = [];
  try { patterns = JSON.parse(fs.readFileSync(ANTI_PATTERNS_JSON, 'utf8')); } catch { return { blocked: false, warnings: [], matched_tags: [] }; }
  if (!Array.isArray(patterns)) return { blocked: false, warnings: [], matched_tags: [] };

  const goalLower = (task.goal || '').toLowerCase();
  const dodLower = (task.dod || []).join(' ').toLowerCase();
  const searchText = goalLower + ' ' + dodLower;

  const warnings = [];
  const matched_tags = [];

  for (const p of patterns) {
    if (p.trigger_keywords && p.trigger_keywords.some(k => searchText.includes(k.toLowerCase()))) {
      warnings.push({
        tag: p.tag,
        severity: p.severity || 'warning',
        message: p.message
      });
      matched_tags.push(p.tag);

      logEvent(runId, {
        task_id: task.id,
        phase: 'preflight',
        event_type: 'preflight_warning',
        pattern: p.tag,
        severity: p.severity || 'warning'
      });
    }
  }

  if (warnings.length === 0) {
    logEvent(runId, { task_id: task.id, phase: 'preflight', event_type: 'preflight_clear' });
  }

  const blocked = warnings.some(w => w.severity === 'error');

  return { blocked, warnings, matched_tags };
}

// Particles and functional words used as split boundaries
const JP_PARTICLES_RE = /(?:の|に|を|が|は|で|と|から|まで|する|した|して|させる|される|修正|対応|確認|実装|追加|変更|更新|設定|処理)/g;

// Standalone tokens to drop after splitting (exact match)
const JP_STOPWORDS = new Set([
  'の', 'に', 'を', 'が', 'は', 'で', 'と', 'から', 'まで', 'する',
  'した', 'して', 'させる', 'される', '修正', '対応', '確認', '実装',
  '追加', '変更', '更新', '設定', '処理',
]);

function tokenizeGoal(goal) {
  const text = (goal || '').normalize('NFKC');
  const isJapanese = /[\u3040-\u9FFF]/.test(text);

  if (!isJapanese) {
    // English fallback: space-split, filter short words
    return text.toLowerCase()
      .split(/\s+/)
      .filter(w => w.length > 3)
      .slice(0, 5);
  }

  // Japanese:
  // 1. Replace symbol delimiters with space
  // 2. Replace particles/functional words with space (act as word boundaries)
  // 3. Split, filter stopwords and short tokens
  const normalized = text
    .replace(/[（）()「」【】・/／＝=：:、。,.─—]/g, ' ')
    .replace(JP_PARTICLES_RE, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const tokens = normalized
    .split(' ')
    .filter(w => w.length >= 2)
    .filter(w => !JP_STOPWORDS.has(w));

  return [...new Set(tokens)].slice(0, 10);
}

function updateAntiPatterns(errorInfo, task) {
  let patterns = [];
  try { patterns = JSON.parse(fs.readFileSync(ANTI_PATTERNS_JSON, 'utf8')); } catch {}
  if (!Array.isArray(patterns)) patterns = [];

  const existing = patterns.find(p => p.tag === errorInfo.category);
  if (existing) {
    existing.failure_count = (existing.failure_count || 0) + 1;
    existing.last_seen = new Date().toISOString();
  } else {
    const keywords = tokenizeGoal(task.goal || '');

    patterns.push({
      tag: errorInfo.category,
      trigger_keywords: keywords,
      failure_count: 1,
      last_seen: new Date().toISOString(),
      severity: 'warning',
      message: `Past failure: ${errorInfo.hypothesis}`
    });
  }

  fs.writeFileSync(ANTI_PATTERNS_JSON, JSON.stringify(patterns, null, 2));
}

function executeTask(task, runId) {
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
    `- PR body MUST include these exact headings (required by CI):`,
    `  ## Codex: RISKS`,
    `  ## Codex: TESTS`,
    `  ## Codex: EDGE`,
    `  Fill each section with relevant content for the change.`,
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
    logEvent(runId, { task_id: task.id, phase: 'execute', event_type: 'task_succeeded', output_length: result.length });
    return true;
  } catch (err) {
    const errorInfo = classifyError(err);
    task._errorInfo = errorInfo;
    log({ step: 'execute_end', task_id: task.id, status: 'error', error: err.message?.slice(0, 500), error_category: errorInfo.category });
    logEvent(runId, { task_id: task.id, phase: 'execute', event_type: 'task_failed', error_tag: errorInfo.category, error_category: errorInfo.category, retryable: errorInfo.retryable });
    return false;
  }
}

// Main
function main() {
  const runId = String(Date.now());
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

  // Preflight: check anti-patterns
  logEvent(runId, { task_id: task.id, phase: 'execute', event_type: 'task_started' });
  const { blocked, warnings } = preflight(task, runId);
  if (blocked) {
    log({ step: 'preflight_blocked', task_id: task.id, patterns: warnings.filter(w => w.severity === 'error').map(w => w.tag) });
    logEvent(runId, { task_id: task.id, phase: 'preflight', event_type: 'preflight_blocked' });
    writeStatus(status);
    process.exit(0);
  }

  // Execute
  const success = executeTask(task, runId);

  if (success) {
    markDone(task);
    logEvent(runId, { task_id: task.id, phase: 'done', event_type: 'done.marked' });
    status.failure_count = 0;
    status.last_task_id = task.id;
  } else {
    status.failure_count = (status.failure_count || 0) + 1;
    status.last_task_id = task.id;

    // NFD: postmortem + anti-patterns
    const errorInfo = task._errorInfo || classifyError({ message: 'unknown' });
    writePostmortem(task, errorInfo);
    logEvent(runId, { task_id: task.id, phase: 'postmortem', event_type: 'postmortem_written', error_tag: errorInfo.category });
    updateAntiPatterns(errorInfo, task);
    logEvent(runId, { task_id: task.id, phase: 'postmortem', event_type: 'anti_pattern_updated', error_tag: errorInfo.category });

    // NFD: record failure in DONE.json
    let doneList = [];
    try { doneList = JSON.parse(fs.readFileSync(DONE_JSON, 'utf8')); } catch {}
    if (!Array.isArray(doneList)) doneList = [];
    doneList.push({
      id: task.id,
      goal: task.goal,
      failed_at: new Date().toISOString(),
      session: 'nightly',
      status: 'failed',
      error_tag: errorInfo.category,
      retryable: errorInfo.retryable
    });
    fs.writeFileSync(DONE_JSON, JSON.stringify(doneList, null, 2));
  }

  writeStatus(status);
}

main();
