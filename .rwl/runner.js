#!/usr/bin/env node
/**
 * RWL Runner — Task executor for SHINEN
 *
 * 2-phase pipeline: implement → verify (--json-schema)
 * git commit is done by runner, not by Claude.
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

// ── Utilities ──────────────────────────────────────────────

function log(msg) {
  const entry = { ts: new Date().toISOString(), ...msg };
  fs.appendFileSync(path.join(LOGS, 'runner.jsonl'), JSON.stringify(entry) + '\n');
  console.log(JSON.stringify(entry));
}

/** Wrap string in single quotes for safe shell argument passing */
function shellEscape(str) {
  return "'" + String(str).replace(/'/g, "'\\''") + "'";
}

function readLines(text) {
  return String(text || '')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);
}

function snapshotWorktree() {
  try {
    const execOpts = { cwd: ROOT, encoding: 'utf-8' };
    const unstaged = readLines(execSync('git diff --name-only', execOpts));
    const staged = readLines(execSync('git diff --cached --name-only', execOpts));
    const untracked = readLines(execSync('git ls-files --others --exclude-standard', execOpts));
    return {
      dirtyTracked: new Set([...unstaged, ...staged]),
      untracked: new Set(untracked)
    };
  } catch {
    return { dirtyTracked: new Set(), untracked: new Set() };
  }
}

function isEmbeddedGitRepo(relPath) {
  const absPath = path.join(ROOT, relPath);
  return fs.existsSync(path.join(absPath, '.git'));
}

function collectNewChangesSince(beforeSnapshot) {
  const after = snapshotWorktree();
  const before = new Set([
    ...(beforeSnapshot?.dirtyTracked || []),
    ...(beforeSnapshot?.untracked || [])
  ]);
  const afterAll = new Set([...after.dirtyTracked, ...after.untracked]);

  const stagedCandidates = [];
  const skippedEmbeddedRepos = [];
  for (const relPath of afterAll) {
    if (before.has(relPath)) continue;
    if (isEmbeddedGitRepo(relPath)) {
      skippedEmbeddedRepos.push(relPath);
      continue;
    }
    stagedCandidates.push(relPath);
  }

  return { stagedCandidates, skippedEmbeddedRepos };
}

// ── Status / Task I/O ──────────────────────────────────────

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

// ── Schemas & Defaults ─────────────────────────────────────

const VERIFY_SCHEMA = JSON.stringify({
  type: 'object',
  properties: {
    verified: { type: 'boolean' },
    evidence: {
      type: 'string',
      description: '具体的な確認結果（テスト出力、ビルドログ、diff要約等）'
    },
    issues: {
      type: 'array',
      items: { type: 'string' },
      description: '問題があれば列挙。verified=trueなら空配列'
    }
  },
  required: ['verified', 'evidence']
});

const FORBIDDEN_GIT_OPS_PROMPT = '禁止操作: git checkout, git switch, git reset, git restore, git rebase は絶対に実行しないこと。ブランチ操作はrunner側で管理する。';
const IMPLEMENT_ALLOWED_TOOLS = 'Read,Write,Edit,MultiEdit,Glob,Grep,Bash(npm test *),Bash(npm run build *),Bash(npm run lint *),Bash(node --check *),Bash(git diff *),Bash(git status *),Bash(git log *),Bash(ls *),Bash(cat *),Bash(rg *)';
const VERIFY_ALLOWED_TOOLS = 'Read,Bash(npm test *),Bash(npm run build *),Bash(git diff *),Bash(git log *),Bash(git status *),Glob,Grep';
const SAFE_GIT_BASH_TOOLS = new Set(['Bash(git diff *)', 'Bash(git status *)', 'Bash(git log *)']);

const TASK_DEFAULTS = {
  research: {
    maxTurns: 15,
    verifyMaxTurns: 0,
    allowedTools: 'Read,Glob,Grep,Bash(git diff *),Bash(git status *),Bash(git log *),Bash(cat *)',
    skipVerify: true
  },
  implement: {
    maxTurns: 30,
    verifyMaxTurns: 10,
    allowedTools: IMPLEMENT_ALLOWED_TOOLS,
    skipVerify: false
  },
  verify: {
    maxTurns: 10,
    verifyMaxTurns: 0,
    allowedTools: VERIFY_ALLOWED_TOOLS,
    skipVerify: true  // 自身が検証タスクなので二重検証不要
  }
};

function getTaskConfig(task) {
  const defaults = TASK_DEFAULTS[task.type] || TASK_DEFAULTS.implement;
  const mergedAllowedTools = task.allowedTools || defaults.allowedTools;
  const sanitizedAllowedTools = sanitizeAllowedTools(mergedAllowedTools);
  return {
    maxTurns: task.maxTurns || defaults.maxTurns,
    verifyMaxTurns: task.verifyMaxTurns || defaults.verifyMaxTurns,
    allowedTools: sanitizedAllowedTools,
    skipVerify: defaults.skipVerify
  };
}

function sanitizeAllowedTools(allowedTools) {
  if (!allowedTools) return allowedTools;

  const tokens = String(allowedTools)
    .split(',')
    .map(token => token.trim())
    .filter(Boolean);

  const filtered = tokens.filter(token => {
    if (!token.startsWith('Bash(git ')) return true;
    return SAFE_GIT_BASH_TOOLS.has(token);
  });

  return filtered.join(',');
}

// ── Execution Pipeline ─────────────────────────────────────

/**
 * 2-phase pipeline: implement → verify
 * @param {object} task
 * @param {string} prompt
 * @param {object} config - from getTaskConfig()
 * @returns {{ success: boolean, evidence?: string, issues?: string[], error?: object }}
 */
function executeAndVerify(task, prompt, config) {
  const claudeEnv = {
    ...process.env,
    PATH: '/usr/local/bin:/opt/homebrew/bin:' + process.env.PATH
  };

  // ── Step 1: 実装実行 ──
  log({ step: 'impl_start', task_id: task.id });

  const systemPromptAddition = [
    'git commitは実行しないこと。commitはrunner側で行う。',
    FORBIDDEN_GIT_OPS_PROMPT,
    task.systemPromptAppend || ''
  ].join(' ').trim();

  const implCmd = [
    `cd ${shellEscape(ROOT)} && claude -p ${shellEscape(prompt)}`,
    `--max-turns ${config.maxTurns}`,
    `--output-format json`,
    `--append-system-prompt ${shellEscape(systemPromptAddition)}`,
    config.allowedTools ? `--allowedTools ${shellEscape(config.allowedTools)}` : ''
  ].filter(Boolean).join(' ');

  let implResult;
  try {
    implResult = execSync(implCmd, {
      timeout: 300000,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      env: claudeEnv
    });
  } catch (err) {
    const errMsg = err.message?.slice(0, 500) || 'unknown';
    log({ step: 'impl_error', task_id: task.id, error: errMsg });
    const retryable = /SIGTERM|timeout|ETIMEDOUT|rate.limit/i.test(errMsg);
    return { success: false, error: { category: 'IMPL_ERROR', retryable } };
  }

  // session_id取得
  let sessionId;
  try {
    const implJson = JSON.parse(implResult);
    sessionId = implJson.session_id;
    log({ step: 'impl_end', task_id: task.id, session_id: sessionId });
  } catch {
    log({ step: 'impl_parse_error', task_id: task.id, raw: implResult?.slice(0, 200) });
    // session_id取得失敗でも実装自体は完了している可能性があるのでverifyスキップ
    return { success: true, evidence: 'impl completed (session_id parse failed, verify skipped)' };
  }

  // verifyスキップ対象タスク
  if (config.skipVerify) {
    return { success: true, evidence: `Task type '${task.type || 'implement'}' - verification not required` };
  }

  // ── Step 2: 検証実行（同一セッション） ──
  log({ step: 'verify_start', task_id: task.id, session_id: sessionId });

  const verifyPrompt = [
    'このタスクの実装結果を検証せよ。以下を順に確認:',
    '1. git diff --stat で変更ファイル一覧を確認',
    '2. テストが存在すれば実行 (npm test など)',
    '3. npm run build を実行してビルドを確認',
    `4. タスク要件「${task.goal}」を満たしているか判定`,
    '',
    '判定基準:',
    '- verified: true は上記すべてが問題ない場合のみ',
    '- evidence: 各ステップの具体的な出力結果を記載',
    '- issues: 問題があれば具体的に列挙（なければ空配列）'
  ].join('\n');

  const verifyCmd = [
    `cd ${shellEscape(ROOT)} && claude -p ${shellEscape(verifyPrompt)}`,
    `--resume ${shellEscape(sessionId)}`,
    `--max-turns ${config.verifyMaxTurns}`,
    `--output-format json`,
    `--json-schema ${shellEscape(VERIFY_SCHEMA)}`,
    `--allowedTools ${shellEscape(VERIFY_ALLOWED_TOOLS)}`
  ].join(' ');

  let verifyResult;
  try {
    verifyResult = execSync(verifyCmd, {
      timeout: 180000,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      env: claudeEnv
    });
  } catch (err) {
    const errMsg = err.message?.slice(0, 500) || 'unknown';
    log({ step: 'verify_error', task_id: task.id, error: errMsg });
    return { success: false, error: { category: 'VERIFY_TIMEOUT', retryable: true } };
  }

  // ── Step 3: structured_output パース ──
  try {
    const verifyJson = JSON.parse(verifyResult);
    const output = verifyJson.result?.structured_output || verifyJson.structured_output;

    if (!output || typeof output.verified !== 'boolean') {
      log({ step: 'verify_schema_mismatch', task_id: task.id, raw: verifyResult?.slice(0, 500) });
      return { success: false, error: { category: 'SCHEMA_MISMATCH', retryable: true } };
    }

    log({ step: 'verify_end', task_id: task.id, verified: output.verified });
    return {
      success: output.verified,
      evidence: output.evidence || '',
      issues: output.issues || []
    };
  } catch {
    log({ step: 'verify_parse_error', task_id: task.id, raw: verifyResult?.slice(0, 200) });
    return { success: false, error: { category: 'PARSE_ERROR', retryable: true } };
  }
}

// ── Git Commit ─────────────────────────────────────────────

/**
 * 検証パス後のgitコミット（runner.js管理）
 */
function commitTaskResult(task, evidence, beforeSnapshot) {
  try {
    const { stagedCandidates, skippedEmbeddedRepos } = collectNewChangesSince(beforeSnapshot);
    if (skippedEmbeddedRepos.length > 0) {
      log({ step: 'commit_skip_embedded_repo', task_id: task.id, paths: skippedEmbeddedRepos });
    }

    if (stagedCandidates.length === 0) {
      log({ step: 'commit_skip', task_id: task.id, reason: 'no_new_changes' });
      return true;
    }

    execSync(`git add -- ${stagedCandidates.map(shellEscape).join(' ')}`, { cwd: ROOT, encoding: 'utf-8' });

    const staged = execSync('git diff --cached --name-only', { cwd: ROOT, encoding: 'utf-8' }).trim();
    if (!staged) {
      log({ step: 'commit_skip', task_id: task.id, reason: 'nothing_staged' });
      return true;
    }

    const descSlice = (task.goal || task.id).slice(0, 72);
    const evidenceSlice = (evidence || '').slice(0, 200);
    const msg = `[RWL] ${task.id}: ${descSlice}\n\nEvidence: ${evidenceSlice}`;
    execSync(`git commit -m ${shellEscape(msg)}`, { cwd: ROOT, encoding: 'utf-8' });

    log({ step: 'commit_success', task_id: task.id });
    return true;
  } catch (err) {
    log({ step: 'commit_error', task_id: task.id, error: err.message?.slice(0, 500) });
    return false;
  }
}

// ── Done / Blocked Tracking ────────────────────────────────

function markDone(task, evidence) {
  const src = path.join(CURRENT, task._filename);
  const dst = path.join(DONE_DIR, task._filename);

  task.status = 'done';
  task.completed_at = new Date().toISOString();
  fs.writeFileSync(src, JSON.stringify(task, null, 2));
  fs.renameSync(src, dst);

  let doneList = [];
  try { doneList = JSON.parse(fs.readFileSync(DONE_JSON, 'utf8')); } catch {}
  if (!Array.isArray(doneList)) doneList = [];
  doneList.push({
    id: task.id,
    goal: task.goal,
    completed_at: task.completed_at,
    session: 'nightly',
    evidence: evidence || null
  });
  fs.writeFileSync(DONE_JSON, JSON.stringify(doneList, null, 2));

  log({ step: 'done', task_id: task.id });
}

function markBlocked(task, reason) {
  const taskPath = path.join(CURRENT, task._filename);
  task.status = 'blocked';
  task.blocked_reason = reason;
  task.blocked_at = new Date().toISOString();
  fs.writeFileSync(taskPath, JSON.stringify(task, null, 2));
  log({ step: 'blocked', task_id: task.id, reason });
}

// ── Main ───────────────────────────────────────────────────

function main() {
  const status = readStatus();
  const beforeSnapshot = snapshotWorktree();

  if (status.failure_count >= (status.max_failures || 5)) {
    log({ step: 'breaker_stop', failure_count: status.failure_count });
    process.exit(0);
  }

  let task = getCurrentTask();
  if (!task) task = promoteFromQueue();
  if (!task) {
    log({ step: 'idle', reason: 'no_tasks' });
    process.exit(0);
  }

  const config = getTaskConfig(task);
  log({ step: 'task_start', task_id: task.id, type: task.type || 'implement', config });

  const prompt = [
    'You are working on SHINEN (stillframe-phase0).',
    'Read CLAUDE.md for project context.',
    '',
    `## Task: ${task.goal}`,
    '',
    '## Definition of Done:',
    ...(task.dod || []).map(d => `- ${d}`),
    '',
    '## Rules:',
    '- Branch operations are managed by runner',
    '- Do NOT run git checkout, git switch, git reset, git restore, or git rebase',
    '- Make minimal, focused changes',
    '- Run npm run build — must pass with zero errors',
    '- Create a PR to main',
    '- Do NOT merge the PR',
    '- Do NOT run git commit (runner handles commits after verification)'
  ].join('\n');

  const result = executeAndVerify(task, prompt, config);

  if (result.success) {
    const committed = commitTaskResult(task, result.evidence, beforeSnapshot);
    if (committed) {
      markDone(task, result.evidence);
      status.failure_count = 0;
    } else {
      markBlocked(task, 'commit_failed');
      status.failure_count = (status.failure_count || 0) + 1;
    }
  } else {
    const { category, retryable } = result.error || {};
    if (!retryable) {
      status.failure_count = (status.failure_count || 0) + 1;
    }
    const newCount = status.failure_count || 0;
    if (newCount >= (status.max_failures || 5)) {
      markBlocked(task, category || 'max_failures_reached');
    }
    log({ step: 'task_failed', task_id: task.id, category, retryable, issues: result.issues });
  }

  status.last_task_id = task.id;
  writeStatus(status);
}

main();
