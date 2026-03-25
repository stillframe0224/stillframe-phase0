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
import { execFileSync, execSync } from 'child_process';
import { createHash } from 'crypto';
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

const QUARANTINE = path.join(RWL, 'Quarantine');

// --- Verify Agent paths (resolved from repo root, cwd-independent) ---
const CLAUDE_CONFIG = path.join(ROOT, '.claude', 'config');
const CLAUDE_PROMPTS = path.join(ROOT, '.claude', 'prompts');
const CLAUDE_RESULTS = path.join(ROOT, '.claude', 'results');
const TEMPLATES_PATH = path.join(CLAUDE_CONFIG, 'contract_templates.json');
const ALIASES_PATH = path.join(CLAUDE_CONFIG, 'command_aliases.json');
const VERIFY_PROMPT_PATH = path.join(CLAUDE_PROMPTS, 'verify-agent.md');

// Ensure dirs exist
[CURRENT, DONE_DIR, QUEUE, LOGS, SESSIONS_DIR, LESSONS_DIR, QUARANTINE].forEach(d => fs.mkdirSync(d, { recursive: true }));

function parsePositiveIntEnv(name, fallback) {
  const raw = process.env[name];
  if (raw == null || raw === '') return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getTaskComplexityLimits() {
  return {
    maxPromptChars: parsePositiveIntEnv('RWL_MAX_PROMPT_CHARS', 2200),
    maxPlanSectionChars: parsePositiveIntEnv('RWL_MAX_PLAN_SECTION_CHARS', 300),
    maxScopeFiles: parsePositiveIntEnv('RWL_MAX_SCOPE_FILES', 3),
    maxVerificationCommands: parsePositiveIntEnv('RWL_MAX_VERIFICATION_COMMANDS', 2),
    maxDodItems: parsePositiveIntEnv('RWL_MAX_DOD_ITEMS', 4),
  };
}

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

// === Structured task result parser ===

const TASK_RESULT_VALID_STATUSES = new Set(['completed', 'partial', 'failed', 'blocked']);

/**
 * Extract structured task result from Claude's text output.
 * Strategy (ordered by reliability):
 *   1. Last ```json ... ``` fenced block containing "status"
 *   2. Last bare JSON object starting with {"status":
 * Returns { parsed: object, source: string } or { parsed: null, source: 'none' }.
 */
function parseTaskResult(text) {
  if (!text || typeof text !== 'string') return { parsed: null, source: 'none' };

  // Strategy 1: fenced ```json blocks — take the LAST one that has "status"
  const fencedRe = /```json\s*\n?([\s\S]*?)```/g;
  let lastFenced = null;
  let m;
  while ((m = fencedRe.exec(text)) !== null) {
    try {
      const obj = JSON.parse(m[1].trim());
      if (obj && typeof obj.status === 'string') lastFenced = obj;
    } catch { /* skip malformed */ }
  }
  if (lastFenced && TASK_RESULT_VALID_STATUSES.has(lastFenced.status)) {
    return { parsed: normalizeResult(lastFenced), source: 'fenced' };
  }

  // Strategy 2: bare JSON — last {"status": ...} object
  const bareRe = /\{[\s]*"status"\s*:\s*"[^"]+"/g;
  let lastBareStart = -1;
  while ((m = bareRe.exec(text)) !== null) {
    lastBareStart = m.index;
  }
  if (lastBareStart >= 0) {
    // Find matching closing brace
    let depth = 0;
    let end = -1;
    for (let i = lastBareStart; i < text.length; i++) {
      if (text[i] === '{') depth++;
      else if (text[i] === '}') { depth--; if (depth === 0) { end = i + 1; break; } }
    }
    if (end > lastBareStart) {
      try {
        const obj = JSON.parse(text.slice(lastBareStart, end));
        if (obj && TASK_RESULT_VALID_STATUSES.has(obj.status)) {
          return { parsed: normalizeResult(obj), source: 'bare' };
        }
      } catch { /* skip */ }
    }
  }

  return { parsed: null, source: 'none' };
}

function normalizeResult(obj) {
  return {
    status: TASK_RESULT_VALID_STATUSES.has(obj.status) ? obj.status : 'completed',
    summary: typeof obj.summary === 'string' ? obj.summary.slice(0, 1000) : '',
    files_changed: Array.isArray(obj.files_changed)
      ? obj.files_changed.filter(f => typeof f === 'string').slice(0, 100)
      : [],
    reason: typeof obj.reason === 'string' ? obj.reason.slice(0, 500) : '',
  };
}

const TASK_RESULT_INSTRUCTION = [
  `## IMPORTANT — Structured result output`,
  `When you finish (success or failure), output EXACTLY one JSON block as the LAST thing in your response.`,
  `Fence it with \`\`\`json ... \`\`\`. The JSON MUST have these fields:`,
  `  {"status":"completed|partial|failed|blocked","summary":"1-2 line summary","files_changed":["path/to/file"],"reason":"why, if failed/blocked"}`,
  `Do NOT omit this block. It is required for automated processing.`,
].join('\n');

function buildExecutionPrompt(task, lessonsAddon = loadLessonsAddon()) {
  return [
    `You are working on SHINEN (stillframe-phase0).`,
    `Read CLAUDE.md for project context.`,
    TASK_RESULT_INSTRUCTION,
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
    ``,
    `## Reminder`,
    `After ALL work is done, you MUST output the structured JSON result block described at the top.`,
  ].join('\n');
}

function getCurrentTask() {
  const files = fs.readdirSync(CURRENT).filter(f => f.endsWith('.json'));
  if (files.length === 0) return null;
  const content = JSON.parse(fs.readFileSync(path.join(CURRENT, files[0]), 'utf8'));
  if (!content.id && content.task_id) content.id = content.task_id;
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
  if (!content.id && content.task_id) content.id = content.task_id;
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

function quarantineTask(task, reason) {
  const src = path.join(CURRENT, task._filename);
  const dst = path.join(QUARANTINE, task._filename);
  const reasonPath = path.join(QUARANTINE, task._filename.replace(/\.json$/, '.reason.txt'));
  fs.renameSync(src, dst);
  fs.writeFileSync(reasonPath, `blocked_reason: ${reason}\n`);
  log({ step: 'quarantine', task_id: task.id, reason });
}

function executeTask(task) {
  log({ step: 'execute_start', task_id: task.id, goal: task.goal });

  // Load lessons addon for prompt injection
  const lessonsAddon = loadLessonsAddon();

  // Build the Claude Code prompt from the task
  const prompt = buildExecutionPrompt(task, lessonsAddon);

  let rawOutput = '';
  let execOk = false;

  try {
    const cliPathPrefix = process.env.RWL_CLAUDE_PATH_PREPEND
      ? `${process.env.RWL_CLAUDE_PATH_PREPEND}:`
      : '';
    // Try to use claude-code CLI
    rawOutput = execFileSync(
      'claude',
      ['-p', prompt, '--max-turns', '20', '--output-format', 'text', '--bare'],
      {
        cwd: ROOT,
        encoding: 'utf8',
        timeout: 240000, // 4 minutes (run.sh has 5 min timeout)
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, PATH: `${cliPathPrefix}/usr/local/bin:/opt/homebrew/bin:${process.env.PATH}` }
      }
    );
    execOk = true;
  } catch (err) {
    // Capture partial stdout even on non-zero exit
    rawOutput = err.stdout || '';
    log({ step: 'execute_end', task_id: task.id, status: 'error', error: err.message?.slice(0, 500) });
  }

  // Parse structured result (best-effort)
  const { parsed: taskResult, source: parseSource } = parseTaskResult(rawOutput);

  // Persist result to .claude/results/
  if (taskResult) {
    try {
      const resultsDir = path.join(ROOT, '.claude', 'results');
      if (!fs.existsSync(resultsDir)) fs.mkdirSync(resultsDir, { recursive: true });
      fs.writeFileSync(
        path.join(resultsDir, `${task.id}_result.json`),
        JSON.stringify({ ...taskResult, _parse_source: parseSource, _task_id: task.id, _at: new Date().toISOString() }, null, 2)
      );
    } catch (writeErr) {
      log({ step: 'result_persist_error', task_id: task.id, error: writeErr.message?.slice(0, 200) });
    }
  }

  log({
    step: 'execute_end',
    task_id: task.id,
    status: execOk ? 'ok' : 'error',
    output_length: rawOutput.length,
    task_result_status: taskResult?.status || null,
    task_result_source: parseSource,
  });

  return { execOk, taskResult };
}

function checkTaskComplexityPreconditions(task) {
  const limits = getTaskComplexityLimits();
  const commands = Array.isArray(task.verification_commands)
    ? task.verification_commands.filter(c => typeof c === 'string' && c.trim())
    : [];
  const allowedSet = collectFileSet(task.allowed_files);
  const requiredSet = collectFileSet(task.required_files);
  const scopeEntriesCount = allowedSet.size + requiredSet.size;
  const planSectionLength = typeof task.plan_section === 'string' ? task.plan_section.length : 0;
  const dodItems = Array.isArray(task.dod)
    ? task.dod.filter(item => typeof item === 'string' && item.trim()).length
    : 0;
  const promptLength = buildExecutionPrompt(task, loadLessonsAddon()).length;

  const metrics = {
    prompt_length_chars: promptLength,
    plan_section_length_chars: planSectionLength,
    allowed_files_count: allowedSet.size,
    required_files_count: requiredSet.size,
    scope_files_count: scopeEntriesCount,
    verification_commands_count: commands.length,
    dod_items_count: dodItems,
  };

  const promptWarnings = [];
  if (metrics.prompt_length_chars > limits.maxPromptChars) {
    promptWarnings.push(`prompt length ${metrics.prompt_length_chars} exceeds ${limits.maxPromptChars}`);
  }

  const oversizedReasons = [];
  if (metrics.plan_section_length_chars > limits.maxPlanSectionChars) {
    oversizedReasons.push(`plan_section length ${metrics.plan_section_length_chars} exceeds ${limits.maxPlanSectionChars}`);
  }
  if (metrics.scope_files_count > limits.maxScopeFiles) {
    oversizedReasons.push(`scope files ${metrics.scope_files_count} exceeds ${limits.maxScopeFiles}`);
  }
  if (metrics.verification_commands_count > limits.maxVerificationCommands) {
    oversizedReasons.push(`verification commands ${metrics.verification_commands_count} exceeds ${limits.maxVerificationCommands}`);
  }
  if (metrics.dod_items_count > limits.maxDodItems) {
    oversizedReasons.push(`DoD items ${metrics.dod_items_count} exceeds ${limits.maxDodItems}`);
  }

  if (oversizedReasons.length === 0) {
    log({
      step: 'task_complexity_preflight',
      task_id: task.id,
      result: 'pass',
      metrics,
      limits,
      prompt_warnings: promptWarnings,
    });
    return { ok: true, prompt_warnings: promptWarnings };
  }

  const blocked_reason = 'task should be split before execution';
  log({
    step: 'task_complexity_preflight',
    task_id: task.id,
    result: 'blocked',
    blocked_reason,
    oversized_reasons: oversizedReasons,
    prompt_warnings: promptWarnings,
    metrics,
    limits,
  });
  return { ok: false, blocked_reason, oversized_reasons: oversizedReasons, prompt_warnings: promptWarnings };
}

// === Post-execution: allowed_files verification ===

function readPackageJsonMeta() {
  const packageJsonPath = path.join(ROOT, 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    return { exists: false, data: null, error: 'package.json not found' };
  }
  try {
    return {
      exists: true,
      data: JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')),
      error: null,
    };
  } catch (err) {
    return {
      exists: true,
      data: null,
      error: `package.json parse failed: ${err.message?.slice(0, 200) || String(err)}`,
    };
  }
}

function hasPackageDependency(pkg, depName) {
  if (!pkg || typeof pkg !== 'object') return false;
  return Boolean(
    pkg.dependencies?.[depName]
    || pkg.devDependencies?.[depName]
    || pkg.peerDependencies?.[depName]
    || pkg.optionalDependencies?.[depName]
  );
}

function checkVerificationCommandPreconditions(task) {
  const commands = Array.isArray(task.verification_commands)
    ? task.verification_commands.filter(c => typeof c === 'string' && c.trim())
    : [];

  if (commands.length === 0) {
    log({
      step: 'verification_preflight',
      task_id: task.id,
      result: 'skipped',
      reason: 'verification_commands not defined',
    });
    return { ok: true };
  }

  const needs = { npmTest: false, npxVitest: false, npxJest: false, npmRunBuild: false };
  for (const cmd of commands) {
    const normalized = cmd.toLowerCase();
    if (/\bnpm\s+test\b/.test(normalized) || /\bnpm\s+run\s+test\b/.test(normalized)) {
      needs.npmTest = true;
    }
    if (/\bnpx\s+vitest\b/.test(normalized)) {
      needs.npxVitest = true;
    }
    if (/\bnpx\s+jest\b/.test(normalized)) {
      needs.npxJest = true;
    }
    if (/\bnpm\s+run\s+build\b/.test(normalized)) {
      needs.npmRunBuild = true;
    }
  }

  if (!needs.npmTest && !needs.npxVitest && !needs.npxJest && !needs.npmRunBuild) {
    log({
      step: 'verification_preflight',
      task_id: task.id,
      result: 'skipped',
      reason: 'no recognized preflight commands',
      verification_commands: commands,
    });
    return { ok: true };
  }

  const pkgMeta = readPackageJsonMeta();
  const missing_requirements = [];

  if (needs.npmTest) {
    if (!pkgMeta.exists) {
      missing_requirements.push('npm test requested but package.json not found');
    } else if (pkgMeta.error) {
      missing_requirements.push(`npm test requested but ${pkgMeta.error}`);
    } else if (!pkgMeta.data?.scripts?.test) {
      missing_requirements.push('npm test requested but scripts.test is missing');
    }
  }

  if (needs.npxVitest) {
    if (!pkgMeta.exists) {
      missing_requirements.push('npx vitest requested but package.json not found');
    } else if (pkgMeta.error) {
      missing_requirements.push(`npx vitest requested but ${pkgMeta.error}`);
    } else if (!hasPackageDependency(pkgMeta.data, 'vitest')) {
      missing_requirements.push('npx vitest requested but vitest is not installed');
    }
  }

  if (needs.npxJest) {
    if (!pkgMeta.exists) {
      missing_requirements.push('npx jest requested but package.json not found');
    } else if (pkgMeta.error) {
      missing_requirements.push(`npx jest requested but ${pkgMeta.error}`);
    } else if (!hasPackageDependency(pkgMeta.data, 'jest')) {
      missing_requirements.push('npx jest requested but jest is not installed');
    }
  }

  if (needs.npmRunBuild) {
    if (!pkgMeta.exists) {
      missing_requirements.push('npm run build requested but package.json not found');
    } else if (pkgMeta.error) {
      missing_requirements.push(`npm run build requested but ${pkgMeta.error}`);
    } else if (!pkgMeta.data?.scripts?.build) {
      missing_requirements.push('npm run build requested but scripts.build is missing');
    }
  }

  if (missing_requirements.length > 0) {
    const blocked_reason = missing_requirements.join('; ');
    log({
      step: 'verification_preflight',
      task_id: task.id,
      result: 'blocked',
      blocked_reason,
      missing_requirements,
      verification_commands: commands,
    });
    return { ok: false, blocked_reason, missing_requirements };
  }

  log({
    step: 'verification_preflight',
    task_id: task.id,
    result: 'pass',
    verification_commands: commands,
    checks: needs,
  });
  return { ok: true };
}

function parsePorcelainEntries(rawStatus) {
  const parsed = [];
  const lines = rawStatus.split(/\r?\n/).filter(Boolean);

  for (const line of lines) {
    if (line.length < 4) continue;
    const xy = line.slice(0, 2);
    const rest = line.slice(3);

    if (!rest) continue;
    if (xy === '!!') continue; // ignored files

    if (xy === '??') {
      parsed.push({ path: rest, state: 'untracked' });
      continue;
    }

    const isRenameOrCopy = xy.includes('R') || xy.includes('C');
    if (isRenameOrCopy && rest.includes(' -> ')) {
      const [fromPath, toPath] = rest.split(' -> ');
      if (fromPath) parsed.push({ path: fromPath, state: 'deleted' });
      if (toPath) parsed.push({ path: toPath, state: 'modified' });
      continue;
    }

    const state = xy.includes('D') ? 'deleted' : 'modified';
    parsed.push({ path: rest, state });
  }

  return parsed;
}

function fingerprintPath(relPath, state) {
  if (state === 'deleted') return '__DELETED__';
  const absPath = path.join(ROOT, relPath);
  if (!fs.existsSync(absPath)) return '__MISSING__';

  const stat = fs.lstatSync(absPath);
  if (stat.isSymbolicLink()) {
    return `symlink:${fs.readlinkSync(absPath)}`;
  }
  if (!stat.isFile()) {
    return `node:${stat.mode}:${stat.size}:${Math.floor(stat.mtimeMs)}`;
  }

  const buf = fs.readFileSync(absPath);
  return `file:${createHash('sha1').update(buf).digest('hex')}`;
}

function captureWorkingTreeSnapshot() {
  const raw = execSync(
    'git -c core.quotepath=false status --porcelain=1 --untracked-files=all',
    {
      cwd: ROOT,
      encoding: 'utf8',
      timeout: 10000,
    }
  );

  const entries = {};
  const tracked_modified = new Set();
  const untracked = new Set();
  const deleted = new Set();

  for (const item of parsePorcelainEntries(raw)) {
    const relPath = item.path;
    if (!relPath) continue;

    if (item.state === 'untracked') {
      untracked.add(relPath);
    } else {
      tracked_modified.add(relPath);
      if (item.state === 'deleted') deleted.add(relPath);
    }

    entries[relPath] = {
      state: item.state,
      fingerprint: fingerprintPath(relPath, item.state),
    };
  }

  return {
    entries,
    tracked_modified: [...tracked_modified].sort(),
    untracked: [...untracked].sort(),
    deleted: [...deleted].sort(),
  };
}

function isRunnerInternalPath(relPath) {
  return relPath === '.rwl/logs/runner.jsonl'
    || relPath === '.rwl/breaker_inputs.json'
    || /^\.rwl\/[^/]+\.patch$/.test(relPath);
}

// === Triad gate ===

const EVENTS_PATH = path.join(RWL, 'EVENTS.jsonl');

function logEvent(runId, event) {
  const entry = { ts: new Date().toISOString(), run_id: runId, ...event };
  fs.appendFileSync(EVENTS_PATH, JSON.stringify(entry) + '\n');
}

function getHeadShort() {
  try {
    return execSync('git rev-parse --short HEAD', { cwd: ROOT, encoding: 'utf8', timeout: 5000 }).trim();
  } catch {
    return null;
  }
}

const LOW_RISK_EXTENSIONS = new Set(['.md', '.txt', '.json', '.yml', '.yaml']);
const CODE_PATH_PREFIXES = ['prompts/', 'circuits/', 'src/', 'lib/', 'app/', 'tools/', 'scripts/'];
const CODE_EXTENSIONS = new Set(['.js', '.ts', '.py']);

function isLowRiskTask(changedFiles) {
  if (!Array.isArray(changedFiles) || changedFiles.length === 0) return false;
  for (const f of changedFiles) {
    const ext = path.extname(f).toLowerCase();
    if (CODE_EXTENSIONS.has(ext)) return false;
    if (CODE_PATH_PREFIXES.some(prefix => f.startsWith(prefix))) return false;
    if (!LOW_RISK_EXTENSIONS.has(ext) && !f.startsWith('docs/')) return false;
  }
  return true;
}

function checkTriadReview(task, changedFiles) {
  const review = task.triad_review;
  const runId = task.id || 'unknown';

  // No triad_review present
  if (!review) {
    if (review === 'legacy_skip') {
      logEvent(runId, { task_id: task.id, event_type: 'triad_legacy_skip' });
      return { ok: true, reason: 'legacy_skip' };
    }
    if (isLowRiskTask(changedFiles)) {
      logEvent(runId, { task_id: task.id, event_type: 'triad_review_low_risk_bypass', changed_files: changedFiles });
      log({ step: 'triad_gate', task_id: task.id, result: 'low_risk_bypass', changed_files: changedFiles });
      return { ok: true, reason: 'low_risk_bypass' };
    }
    logEvent(runId, { task_id: task.id, event_type: 'triad_review_missing' });
    return { ok: false, blocker: 'triad_review_missing', message: 'Blocked: triad_review missing for non-low-risk task' };
  }

  // legacy_skip string
  if (review === 'legacy_skip') {
    logEvent(runId, { task_id: task.id, event_type: 'triad_legacy_skip' });
    return { ok: true, reason: 'legacy_skip' };
  }

  // Validate structure
  const { contract, regression, safety, reviewed_commit, report_path } = review;

  // Check report_path exists
  if (report_path) {
    const reportAbsPath = path.join(ROOT, report_path);
    if (!fs.existsSync(reportAbsPath)) {
      logEvent(runId, { task_id: task.id, event_type: 'triad_report_missing', report_path });
      return { ok: false, blocker: 'triad_report_missing', message: `Blocked: report not found at ${report_path}` };
    }
  }

  // Stale check
  if (reviewed_commit) {
    const head = getHeadShort();
    if (head && reviewed_commit !== head) {
      logEvent(runId, { task_id: task.id, event_type: 'triad_review_stale', reviewed_commit, head });
      return { ok: false, blocker: 'triad_review_stale', message: `Blocked: triad_review stale (reviewed_commit ${reviewed_commit} != HEAD ${head})` };
    }
  }

  // FAIL check
  for (const axis of ['contract', 'regression', 'safety']) {
    const val = review[axis];
    if (val === 'FAIL') {
      logEvent(runId, { task_id: task.id, event_type: `triad_review_fail_${axis}` });
      return { ok: false, blocker: `triad_review_fail_${axis}`, message: `Blocked: triad_review ${axis} = FAIL` };
    }
  }

  // All PASS/WARN
  logEvent(runId, { task_id: task.id, event_type: 'triad_ship_passed', triad_review: review });
  return { ok: true, reason: 'triad_pass' };
}

function computeTaskChangedFiles(beforeSnapshot, afterSnapshot) {
  const beforeEntries = beforeSnapshot?.entries || {};
  const afterEntries = afterSnapshot?.entries || {};
  const allPaths = new Set([
    ...Object.keys(beforeEntries),
    ...Object.keys(afterEntries),
  ]);

  const actual = [];
  const deleted_by_task = [];

  for (const relPath of [...allPaths].sort()) {
    const before = beforeEntries[relPath];
    const after = afterEntries[relPath];

    if (!before && after) {
      actual.push(relPath);
      if (after.state === 'deleted') deleted_by_task.push(relPath);
      continue;
    }
    if (before && !after) {
      actual.push(relPath);
      continue;
    }
    if (!before || !after) continue;

    if (before.state !== after.state || before.fingerprint !== after.fingerprint) {
      actual.push(relPath);
      if (after.state === 'deleted') deleted_by_task.push(relPath);
    }
  }

  return {
    actual: actual.filter(p => !isRunnerInternalPath(p)),
    deleted_by_task: deleted_by_task.filter(p => !isRunnerInternalPath(p)),
  };
}

function collectFileSet(spec) {
  const set = new Set();
  if (!spec) return set;

  if (Array.isArray(spec)) {
    for (const p of spec) {
      if (typeof p === 'string' && p.trim()) set.add(p.trim());
    }
    return set;
  }

  if (typeof spec !== 'object') return set;

  for (const key of ['modify', 'create', 'delete']) {
    const arr = spec[key];
    if (!Array.isArray(arr)) continue;
    for (const p of arr) {
      if (typeof p === 'string' && p.trim()) set.add(p.trim());
    }
  }
  return set;
}

function verifyAllowedFiles(task, beforeSnapshot, afterSnapshot) {
  const allowedSet = collectFileSet(task.allowed_files);
  const requiredSet = collectFileSet(task.required_files);

  if (allowedSet.size === 0 && requiredSet.size === 0) {
    log({
      step: 'file_verify',
      task_id: task.id,
      result: 'skipped',
      reason: 'allowed_files and required_files are both empty',
    });
    return { ok: true };
  }

  if (!beforeSnapshot || !afterSnapshot) {
    log({ step: 'file_verify', task_id: task.id, result: 'error', error: 'snapshot missing' });
    return { ok: false, error: 'snapshot missing' };
  }

  const { actual, deleted_by_task } = computeTaskChangedFiles(beforeSnapshot, afterSnapshot);
  const actualSet = new Set(actual);
  const unexpected_changes = allowedSet.size === 0
    ? []
    : actual.filter(f => !allowedSet.has(f));
  const missing_changes = requiredSet.size === 0
    ? []
    : [...requiredSet].filter(f => !actualSet.has(f));

  if (unexpected_changes.length === 0 && missing_changes.length === 0) {
    log({
      step: 'file_verify',
      task_id: task.id,
      result: 'pass',
      actual_files: actual,
      allowed_files: [...allowedSet],
      required_files: [...requiredSet],
      snapshot_before_counts: {
        tracked_modified: beforeSnapshot.tracked_modified.length,
        untracked: beforeSnapshot.untracked.length,
        deleted: beforeSnapshot.deleted.length,
      },
      snapshot_after_counts: {
        tracked_modified: afterSnapshot.tracked_modified.length,
        untracked: afterSnapshot.untracked.length,
        deleted: afterSnapshot.deleted.length,
      },
    });
    return { ok: true };
  }

  log({
    step: 'file_verify',
    task_id: task.id,
    result: 'mismatch',
    unexpected_changes,
    missing_changes,
    deleted_by_task,
    allowed_files: [...allowedSet],
    required_files: [...requiredSet],
    actual,
    snapshot_before_counts: {
      tracked_modified: beforeSnapshot.tracked_modified.length,
      untracked: beforeSnapshot.untracked.length,
      deleted: beforeSnapshot.deleted.length,
    },
    snapshot_after_counts: {
      tracked_modified: afterSnapshot.tracked_modified.length,
      untracked: afterSnapshot.untracked.length,
      deleted: afterSnapshot.deleted.length,
    },
  });
  return { ok: false, unexpected_changes, missing_changes };
}

// === Verify Agent: contract generation, verification, decision table ===

function loadContractTemplates() {
  try {
    return JSON.parse(fs.readFileSync(TEMPLATES_PATH, 'utf8'));
  } catch (err) {
    log({ step: 'verify_config_error', error: `Failed to load contract_templates.json: ${err.message}` });
    return null;
  }
}

function loadCommandAliases() {
  try {
    return JSON.parse(fs.readFileSync(ALIASES_PATH, 'utf8')).aliases || {};
  } catch {
    return {};
  }
}

function getVerifyArtifactTaskId(task) {
  return task.task_id || task.id || task._filename?.replace(/\.json$/, '') || 'unknown-task';
}

function isVerifyAwareTask(task) {
  return task.task_id != null || task.risk_level != null || task.scope != null;
}

/**
 * §5 — validateTask: check required fields for verify pipeline.
 * Returns { valid, errors }.
 */
function validateTask(task, templates) {
  const errors = [];

  if (!task.task_id) errors.push('task_id is required');
  if (!task.type) errors.push('type is required');
  if (!task.risk_level) errors.push('risk_level is required');
  if (!task.goal) errors.push('goal is required');

  const validTypes = templates ? Object.keys(templates.types || {}) : [];
  if (task.type && validTypes.length > 0 && !validTypes.includes(task.type)) {
    errors.push(`Unknown type: ${task.type}. Valid: ${validTypes.join(', ')}`);
  }

  const validRisks = ['low', 'medium', 'high'];
  if (task.risk_level && !validRisks.includes(task.risk_level)) {
    errors.push(`Unknown risk_level: ${task.risk_level}`);
  }

  if (!Array.isArray(task.scope?.include) || task.scope.include.length === 0) {
    errors.push('scope.include must have at least one entry');
  }

  if (task.risk_level === 'high') {
    const hasAcceptance = task.acceptance?.commands?.length > 0 || task.acceptance?.assertions?.length > 0;
    if (!hasAcceptance) {
      errors.push('high risk tasks require at least one acceptance command or assertion');
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * §4.3 — generateContract: pure function, no LLM.
 * Merges template defaults with task-specific acceptance commands.
 */
function generateContract(task, templates) {
  const taskId = task.task_id;
  const typeTemplate = templates.types[task.type];
  if (!typeTemplate) throw new Error(`Unknown task type: ${task.type}`);

  const riskOverride = templates.risk_overrides[task.risk_level];
  if (!riskOverride) throw new Error(`Unknown risk_level: ${task.risk_level}`);

  const aliases = loadCommandAliases();

  // Resolve short command names in template acceptance_plan
  const resolvedTemplatePlan = (typeTemplate.acceptance_plan || []).map(s => aliases[s] || s);

  // Merge with task-specific commands (deduplicate)
  const taskCommands = (task.acceptance?.commands || []).map(s => aliases[s] || s);
  const mergedPlan = [...resolvedTemplatePlan];
  for (const cmd of taskCommands) {
    if (!mergedPlan.includes(cmd)) mergedPlan.push(cmd);
  }

  const contract = {
    task_id: taskId,
    type: task.type,
    risk_level: task.risk_level,
    scope: task.scope || { include: ['**'], exclude: [] },
    acceptance_plan: {
      commands: mergedPlan,
      assertions: [...(task.acceptance?.assertions || [])],
    },
    evidence_required: [...typeTemplate.evidence_required],
    failure_conditions: [...typeTemplate.failure_conditions],
    verify_policy: riskOverride.verify_policy,
    generated_at: new Date().toISOString(),
  };

  log({ step: 'contract_generated', task_id: taskId, verify_policy: contract.verify_policy, type: task.type, risk_level: task.risk_level });
  return contract;
}

/** §6.1 — shouldRunVerify */
function shouldRunVerify(contract) {
  return contract.verify_policy !== 'skip';
}

function runAcceptanceChecks(task, contract) {
  const taskId = getVerifyArtifactTaskId(task);
  const commands = Array.isArray(contract.acceptance_plan?.commands)
    ? contract.acceptance_plan.commands.filter(cmd => typeof cmd === 'string' && cmd.trim())
    : [];
  const assertions = Array.isArray(contract.acceptance_plan?.assertions)
    ? contract.acceptance_plan.assertions
    : [];
  const command_results = [];

  log({
    step: 'acceptance_start',
    task_id: taskId,
    commands,
    assertions_count: assertions.length,
  });

  for (const command of commands) {
    const started_at = new Date().toISOString();
    try {
      const output = execSync(command, {
        cwd: ROOT,
        encoding: 'utf8',
        timeout: 120_000,
        maxBuffer: 10 * 1024 * 1024,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, PATH: '/usr/local/bin:/opt/homebrew/bin:' + process.env.PATH },
      });
      command_results.push({
        command,
        status: 'pass',
        exit_code: 0,
        started_at,
        finished_at: new Date().toISOString(),
        output_excerpt: output.trim().slice(0, 4000),
      });
    } catch (err) {
      const output = [err.stdout, err.stderr].filter(Boolean).join('\n').trim();
      command_results.push({
        command,
        status: 'fail',
        exit_code: Number.isInteger(err.status) ? err.status : 1,
        started_at,
        finished_at: new Date().toISOString(),
        output_excerpt: (output || err.message || '').slice(0, 4000),
      });
      const acceptanceResult = {
        passed: false,
        command_results,
        assertions,
      };
      log({
        step: 'acceptance_complete',
        task_id: taskId,
        passed: false,
        failed_command: command,
      });
      return acceptanceResult;
    }
  }

  const acceptanceResult = {
    passed: true,
    command_results,
    assertions,
  };
  log({
    step: 'acceptance_complete',
    task_id: taskId,
    passed: true,
    commands_run: command_results.length,
  });
  return acceptanceResult;
}

/**
 * §6.2 — runVerifyAgent: invoke claude -p with verify prompt via execSync.
 * Returns VERIFY_RESULT object. Saves to .claude/results/{task_id}/.
 */
function runVerifyAgent(task, contract, execResultData, acceptanceResult) {
  const taskId = getVerifyArtifactTaskId(task);
  const resultDir = path.join(CLAUDE_RESULTS, taskId);
  fs.mkdirSync(resultDir, { recursive: true });

  let promptTemplate;
  try {
    promptTemplate = fs.readFileSync(VERIFY_PROMPT_PATH, 'utf8');
    log({ step: 'verify_prompt_loaded', task_id: taskId, path: VERIFY_PROMPT_PATH });
  } catch (err) {
    const fallback = {
      verdict: 'fail',
      fail_reasons: [`Could not load verify prompt: ${err.message}`],
      warnings: [],
      evidence_checked: [],
      assertion_results: [],
    };
    fs.writeFileSync(path.join(resultDir, 'VERIFY_RESULT.json'), JSON.stringify(fallback, null, 2));
    log({ step: 'verify_prompt_error', task_id: taskId, error: err.message });
    return fallback;
  }

  const contractPath = path.join(resultDir, 'EXECUTION_CONTRACT.json');
  const acceptanceLogPath = path.join(resultDir, 'acceptance.log');

  fs.writeFileSync(contractPath, JSON.stringify(contract, null, 2) + '\n');
  if (acceptanceResult) {
    fs.writeFileSync(acceptanceLogPath, JSON.stringify(acceptanceResult, null, 2) + '\n');
  }

  // Collect evidence paths
  const evidencePaths = [];
  if (fs.existsSync(contractPath)) evidencePaths.push(contractPath);
  if (fs.existsSync(acceptanceLogPath)) evidencePaths.push(acceptanceLogPath);

  // git diff --stat
  let diffStat = '(unavailable)';
  try {
    diffStat = execSync('git diff --stat', { cwd: ROOT, encoding: 'utf8', timeout: 10000 });
  } catch {}

  // Replace placeholders
  const prompt = promptTemplate
    .replace('{{contract}}', JSON.stringify(contract, null, 2))
    .replace('{{execResult}}', JSON.stringify(execResultData || {}, null, 2))
    .replace('{{acceptanceLog}}', JSON.stringify(acceptanceResult || {}, null, 2))
    .replace('{{diffStat}}', diffStat)
    .replace('{{evidencePaths}}', evidencePaths.join('\n'));

  // Write prompt to temp file to avoid shell escaping issues
  const tmpPromptPath = path.join(resultDir, '_verify_prompt.tmp');
  fs.writeFileSync(tmpPromptPath, prompt);

  let verifyResult;
  try {
    const cliPathPrefix = process.env.RWL_CLAUDE_PATH_PREPEND
      ? `${process.env.RWL_CLAUDE_PATH_PREPEND}:`
      : '';
    const output = execFileSync(
      'claude',
      ['-p', prompt, '--model', 'claude-sonnet-4-20250514', '--output-format', 'json'],
      {
        cwd: ROOT,
        encoding: 'utf8',
        timeout: 120_000,
        maxBuffer: 10 * 1024 * 1024,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, PATH: `${cliPathPrefix}/usr/local/bin:/opt/homebrew/bin:${process.env.PATH}` },
      }
    );

    let parsed = tryParseVerifyOutput(output.trim());

    const validVerdicts = ['pass', 'fail', 'marginal'];
    if (!parsed || !validVerdicts.includes(parsed.verdict)) {
      throw new Error('Invalid or missing verdict in verify output');
    }

    verifyResult = {
      verdict: parsed.verdict,
      fail_reasons: Array.isArray(parsed.fail_reasons) ? parsed.fail_reasons : [],
      warnings: Array.isArray(parsed.warnings) ? parsed.warnings : [],
      evidence_checked: Array.isArray(parsed.evidence_checked) ? parsed.evidence_checked : [],
      assertion_results: Array.isArray(parsed.assertion_results) ? parsed.assertion_results : [],
    };
  } catch (err) {
    verifyResult = {
      verdict: 'fail',
      fail_reasons: [`JSON parse failed: ${err.message}`],
      warnings: [],
      evidence_checked: [],
      assertion_results: [],
    };
  } finally {
    // Clean up temp file
    try { fs.unlinkSync(tmpPromptPath); } catch {}
  }

  fs.writeFileSync(path.join(resultDir, 'VERIFY_RESULT.json'), JSON.stringify(verifyResult, null, 2));
  log({ step: 'verify_complete', task_id: taskId, verdict: verifyResult.verdict });
  return verifyResult;
}

/** Try to parse verify agent output — handles claude JSON envelope and raw JSON */
function tryParseVerifyOutput(output) {
  if (!output) return null;

  // Try direct parse
  try {
    const obj = JSON.parse(output);
    // claude --output-format json may wrap in { result: "..." }
    if (obj.result && typeof obj.result === 'string') {
      try {
        const inner = JSON.parse(obj.result);
        if (inner.verdict) return inner;
      } catch {}
      // Try to extract JSON from result string
      const m = obj.result.match(/\{[\s\S]*"verdict"[\s\S]*\}/);
      if (m) { try { return JSON.parse(m[0]); } catch {} }
    }
    if (obj.verdict) return obj;
  } catch {}

  // Try to find embedded JSON with verdict
  const m = output.match(/\{[\s\S]*"verdict"[\s\S]*\}/);
  if (m) {
    try { return JSON.parse(m[0]); } catch {}
  }

  return null;
}

/**
 * §7.2 — decideFinalStatus: deterministic decision table.
 * exec fail → failed, acceptance fail → failed, skip → complete,
 * pass → complete, fail → failed, marginal → needs_human_review.
 */
function decideFinalStatus({ execOk, acceptancePassed, contract, verifyResult }) {
  if (!execOk) return 'failed';
  if (acceptancePassed === false) return 'failed';

  if (!shouldRunVerify(contract)) return 'complete';

  if (!verifyResult) return 'failed'; // verify required but no result

  switch (verifyResult.verdict) {
    case 'pass':     return 'complete';
    case 'fail':     return 'failed';
    case 'marginal': return 'needs_human_review';
    default:         return 'failed';
  }
}

/** Write verify-agent artifacts to .claude/results/{task_id}/ */
function writeVerifyArtifacts(task, {
  contract = null,
  acceptanceResult = null,
  verifyResult = null,
  finalStatus,
  changedFiles = [],
  failureReasons = [],
}) {
  const taskId = getVerifyArtifactTaskId(task);
  const resultDir = path.join(CLAUDE_RESULTS, taskId);
  fs.mkdirSync(resultDir, { recursive: true });

  // EXECUTION_CONTRACT.json — always
  if (contract) {
    fs.writeFileSync(
      path.join(resultDir, 'EXECUTION_CONTRACT.json'),
      JSON.stringify(contract, null, 2) + '\n'
    );
  }

  // acceptance.log
  if (acceptanceResult) {
    fs.writeFileSync(
      path.join(resultDir, 'acceptance.log'),
      JSON.stringify(acceptanceResult, null, 2) + '\n'
    );
  }

  // VERIFY_RESULT.json — medium/high only (already written by runVerifyAgent, but ensure)
  if ((contract ? shouldRunVerify(contract) : Boolean(verifyResult)) && verifyResult) {
    fs.writeFileSync(
      path.join(resultDir, 'VERIFY_RESULT.json'),
      JSON.stringify(verifyResult, null, 2) + '\n'
    );
  }

  // Extended TASK_RESULT.json
  const taskResult = {
    task_id: taskId,
    status: finalStatus,
    type: task.type || null,
    risk_level: task.risk_level || null,
    changed_files: changedFiles,
    acceptance_results: acceptanceResult?.command_results || [],
    evidence_paths: [
      path.join(resultDir, 'EXECUTION_CONTRACT.json'),
      ...((contract ? shouldRunVerify(contract) : Boolean(verifyResult)) ? [path.join(resultDir, 'VERIFY_RESULT.json')] : []),
      path.join(resultDir, 'acceptance.log'),
    ].filter(p => fs.existsSync(p)),
    known_limits: verifyResult ? verifyResult.warnings : [],
    next_operator_notes: finalStatus === 'needs_human_review'
      ? [`Verify Agent returned marginal — human review required.`, ...(verifyResult?.warnings || [])]
      : failureReasons,
    completed_at: new Date().toISOString(),
  };

  fs.writeFileSync(
    path.join(resultDir, 'TASK_RESULT.json'),
    JSON.stringify(taskResult, null, 2) + '\n'
  );

  log({ step: 'verify_artifacts_written', task_id: taskId, result_dir: resultDir, final_status: finalStatus });
  return taskResult;
}

function failVerifyAwareTask({
  task,
  status,
  governanceResult,
  reason,
  lessonError,
  lessonWorkaround,
  contract = null,
  acceptanceResult = null,
  verifyResult = null,
  changedFiles = [],
}) {
  const failureReasons = verifyResult?.fail_reasons?.length
    ? verifyResult.fail_reasons
    : [reason];

  writeVerifyArtifacts(task, {
    contract,
    acceptanceResult,
    verifyResult,
    finalStatus: 'failed',
    changedFiles,
    failureReasons,
  });

  quarantineTask(task, reason);
  recordLesson(task.id, {
    status: 'blocked',
    error: lessonError,
    workaround: lessonWorkaround,
  });
  status.last_task_id = task.id;
  status.last_error = null;
  status.note = `Execution succeeded but governance blocked: ${governanceResult}`;
  writeStatus(status);
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

  const complexityPreflight = checkTaskComplexityPreconditions(task);
  if (!complexityPreflight.ok) {
    console.error(`[runner] task complexity preflight blocked for ${task.id}: ${complexityPreflight.blocked_reason}`);
    if (complexityPreflight.oversized_reasons?.length) {
      console.error(`  oversized: ${complexityPreflight.oversized_reasons.join('; ')}`);
    }
    const reason = `task complexity preflight failed: ${complexityPreflight.blocked_reason}; ${(complexityPreflight.oversized_reasons || []).join('; ')}`;
    quarantineTask(task, reason);
    recordLesson(task.id, {
      status: 'blocked',
      error: 'task complexity preflight failed',
      workaround: `${complexityPreflight.blocked_reason}; ${(complexityPreflight.oversized_reasons || []).join('; ')}`,
    });
    status.last_task_id = task.id;
    writeStatus(status);
    process.exit(0);
  }

  const preflight = checkVerificationCommandPreconditions(task);
  if (!preflight.ok) {
    console.error(`[runner] verification preflight blocked for ${task.id}: ${preflight.blocked_reason}`);
    quarantineTask(task, `verification preflight failed: ${preflight.blocked_reason}`);
    recordLesson(task.id, {
      status: 'blocked',
      error: 'verification preflight failed',
      workaround: preflight.blocked_reason,
    });
    status.last_task_id = task.id;
    writeStatus(status);
    process.exit(0);
  }

  let beforeSnapshot = null;
  try {
    beforeSnapshot = captureWorkingTreeSnapshot();
  } catch (err) {
    log({
      step: 'snapshot_before_error',
      task_id: task.id,
      error: err.message?.slice(0, 300) || String(err),
    });
  }

  // Execute
  const { execOk: success, taskResult } = executeTask(task);
  let afterSnapshot = null;
  try {
    afterSnapshot = captureWorkingTreeSnapshot();
  } catch (err) {
    log({
      step: 'snapshot_after_error',
      task_id: task.id,
      error: err.message?.slice(0, 300) || String(err),
    });
  }

  // === Two-layer result evaluation ===
  // execution_result: mechanical success/failure (exit code, build, test)
  // governance_result: triad/gate/process completeness
  // failure_count reflects ONLY execution_result — governance issues never increment it.

  const execution_result = success ? 'success' : 'failure';
  let governance_result = 'pending'; // will be set below

  if (success) {
    // Execution succeeded — failure_count MUST be reset regardless of governance outcome
    status.failure_count = 0;

    // Log self-reported status (Phase 1: observe only, exit-code remains authoritative)
    if (taskResult) {
      log({ step: 'self_report', task_id: task.id, self_status: taskResult.status, summary: taskResult.summary, reason: taskResult.reason });
      if (taskResult.status === 'failed' || taskResult.status === 'blocked') {
        console.error(`[runner] NOTICE: task ${task.id} self-reported "${taskResult.status}" but exit code was 0 — marking done per Phase 1 policy (exit-code authoritative)`);
      }
    }

    // Verify allowed_files before marking done
    const verify = verifyAllowedFiles(task, beforeSnapshot, afterSnapshot);
    if (verify.ok) {
      // Triad gate: check triad_review before marking done
      const { actual: taskChangedFiles } = computeTaskChangedFiles(beforeSnapshot, afterSnapshot);
      const triadResult = checkTriadReview(task, taskChangedFiles);
      if (!triadResult.ok) {
        governance_result = triadResult.blocker;
        console.error(`[runner] ${triadResult.message}`);
        log({
          step: 'triad_gate', task_id: task.id, result: 'blocked', blocker: triadResult.blocker,
          execution_result, governance_result,
          note: 'execution succeeded — failure_count reset, task quarantined for governance only',
        });
        quarantineTask(task, triadResult.message);
        recordLesson(task.id, {
          status: 'blocked',
          error: triadResult.blocker,
          workaround: triadResult.message,
        });
        status.last_task_id = task.id;
        status.note = `Execution succeeded but governance blocked: ${triadResult.blocker}`;
        status.last_error = null;
        writeStatus(status);
        return;
      }
      governance_result = 'pass';
      log({
        step: 'triad_gate', task_id: task.id, result: 'passed', reason: triadResult.reason,
        execution_result, governance_result,
      });

      // === Verify Agent pipeline (Phase A) ===
      const verifyAwareTask = isVerifyAwareTask(task);
      if (verifyAwareTask) {
        const templates = loadContractTemplates();
        if (!templates) {
          governance_result = 'verify_config_error';
          const reason = 'Verify Agent config unavailable: contract_templates.json could not be loaded';
          log({ step: 'verify_config_fatal', task_id: task.id, reason });
          failVerifyAwareTask({
            task,
            status,
            governanceResult: governance_result,
            reason,
            lessonError: 'verify_config_error',
            lessonWorkaround: 'Restore .claude/config/contract_templates.json and rerun',
            changedFiles: taskChangedFiles,
          });
          return;
        }

        const validation = validateTask(task, templates);
        if (!validation.valid) {
          governance_result = 'verify_validation_failed';
          const reason = `Verify task validation failed: ${validation.errors.join('; ')}`;
          log({ step: 'verify_validation_failed', task_id: task.id, errors: validation.errors });
          failVerifyAwareTask({
            task,
            status,
            governanceResult: governance_result,
            reason,
            lessonError: `verify_validation_failed: ${validation.errors.join('; ')}`,
            lessonWorkaround: 'Fix task metadata for verify-agent fields and rerun',
            changedFiles: taskChangedFiles,
          });
          return;
        }

        let contract = null;
        let acceptanceResult = null;

        try {
          contract = generateContract(task, templates);
          acceptanceResult = runAcceptanceChecks(task, contract);

          if (!acceptanceResult.passed) {
            governance_result = 'acceptance_failed';
            const failedCommands = acceptanceResult.command_results
              .filter(result => result.status === 'fail')
              .map(result => result.command);
            const reason = `Acceptance failed: ${failedCommands.join('; ') || 'unknown command failure'}`;
            log({
              step: 'acceptance_failed',
              task_id: task.id,
              failed_commands: failedCommands,
            });
            failVerifyAwareTask({
              task,
              status,
              governanceResult: governance_result,
              reason,
              lessonError: reason,
              lessonWorkaround: 'Review acceptance.log and fix failing acceptance commands',
              contract,
              acceptanceResult,
              changedFiles: taskChangedFiles,
            });
            return;
          }

          if (shouldRunVerify(contract)) {
            log({ step: 'verify_start', task_id: task.id, verify_policy: contract.verify_policy });
            const verifyResult = runVerifyAgent(task, contract, taskResult, acceptanceResult);
            const finalStatus = decideFinalStatus({
              execOk: success,
              acceptancePassed: acceptanceResult.passed,
              contract,
              verifyResult,
            });

            log({ step: 'verify_decision', task_id: task.id, verdict: verifyResult.verdict, final_status: finalStatus });

            if (finalStatus === 'failed') {
              governance_result = 'verify_failed';
              failVerifyAwareTask({
                task,
                status,
                governanceResult: governance_result,
                reason: `Verify Agent: ${verifyResult.fail_reasons.join('; ')}`,
                lessonError: `verify_failed: ${verifyResult.fail_reasons.join('; ')}`,
                lessonWorkaround: 'Review VERIFY_RESULT.json and fix issues',
                contract,
                acceptanceResult,
                verifyResult,
                changedFiles: taskChangedFiles,
              });
              return;
            }

            if (finalStatus === 'needs_human_review') {
              governance_result = 'needs_human_review';
              writeVerifyArtifacts(task, {
                contract,
                acceptanceResult,
                verifyResult,
                finalStatus,
                changedFiles: taskChangedFiles,
              });
              quarantineTask(task, `Verify Agent: marginal — human review required. Warnings: ${verifyResult.warnings.join('; ')}`);
              recordLesson(task.id, {
                status: 'blocked',
                error: 'needs_human_review: verify agent returned marginal',
                workaround: 'Human review of VERIFY_RESULT.json required',
              });
              status.last_task_id = task.id;
              status.last_error = null;
              status.note = 'Execution succeeded but governance blocked: needs_human_review';
              writeStatus(status);
              return;
            }

            writeVerifyArtifacts(task, {
              contract,
              acceptanceResult,
              verifyResult,
              finalStatus,
              changedFiles: taskChangedFiles,
            });
          } else {
            log({ step: 'verify_skipped', task_id: task.id, risk_level: task.risk_level });
            writeVerifyArtifacts(task, {
              contract,
              acceptanceResult,
              verifyResult: null,
              finalStatus: 'complete',
              changedFiles: taskChangedFiles,
            });
          }
        } catch (verifyErr) {
          governance_result = 'verify_pipeline_exception';
          const verifyResult = {
            verdict: 'fail',
            fail_reasons: [`Verify pipeline exception: ${verifyErr.message?.slice(0, 500) || String(verifyErr)}`],
            warnings: [],
            evidence_checked: [],
            assertion_results: [],
          };
          log({ step: 'verify_pipeline_error', task_id: task.id, error: verifyErr.message?.slice(0, 500) });
          failVerifyAwareTask({
            task,
            status,
            governanceResult: governance_result,
            reason: verifyResult.fail_reasons[0],
            lessonError: 'verify_pipeline_exception',
            lessonWorkaround: 'Inspect runner logs and verify artifacts before rerun',
            contract,
            acceptanceResult,
            verifyResult: contract && shouldRunVerify(contract) ? verifyResult : null,
            changedFiles: taskChangedFiles,
          });
          return;
        }
      }
      // === End Verify Agent pipeline ===

      markDone(task);
      recordLesson(task.id, {
        status: 'success',
        summary: task.goal,
        ...(taskResult ? { self_report: { status: taskResult.status, summary: taskResult.summary } } : {}),
      });
    } else {
      // Mismatch: quarantine, do NOT mark done
      // This is a governance-layer issue (file scope), NOT an execution failure
      governance_result = 'allowed_files_mismatch';
      console.error(`[runner] allowed_files mismatch for ${task.id} — quarantined`);
      if (verify.unexpected_changes?.length) {
        console.error(`  unexpected: ${verify.unexpected_changes.join(', ')}`);
      }
      if (verify.missing_changes?.length) {
        console.error(`  missing:    ${verify.missing_changes.join(', ')}`);
      }
      log({
        step: 'file_verify_quarantine', task_id: task.id,
        execution_result, governance_result,
        note: 'execution succeeded — failure_count reset, quarantined for file scope violation',
      });
      quarantineTask(task, `allowed_files mismatch: unexpected=[${(verify.unexpected_changes || []).join(',')}] missing=[${(verify.missing_changes || []).join(',')}]`);
      recordLesson(task.id, {
        status: 'blocked',
        error: 'allowed_files mismatch',
        workaround: `Review: unexpected=[${(verify.unexpected_changes || []).join(',')}] missing=[${(verify.missing_changes || []).join(',')}]`,
      });
    }
    status.last_task_id = task.id;
    status.last_error = null;
  } else {
    // Execution FAILED — this is the only path that increments failure_count
    governance_result = 'n/a';
    recordLesson(task.id, { status: 'error', error: `Task failed (attempt ${(status.failure_count || 0) + 1})` });
    status.failure_count = (status.failure_count || 0) + 1;
    status.last_task_id = task.id;
    status.last_error = `execution_failure at attempt ${status.failure_count}`;
    log({
      step: 'execution_failure', task_id: task.id,
      execution_result, governance_result,
      failure_count: status.failure_count,
    });
  }

  writeStatus(status);
}

// ─── task-loader 条件付き統合 (RUN_TASK_LOADER=1 のときだけ先行実行) ───
async function maybeRunTaskLoader() {
  if (process.env.RUN_TASK_LOADER !== '1') return;
  const taskLoaderPath = path.join(process.env.HOME, 'company', 'task-loader.js');
  const { loadAndRunTasks } = await import(`file://${taskLoaderPath}`);
  const taskResults = await loadAndRunTasks({
    tasksDir: path.join(process.env.HOME, 'company', 'tasks'),
    reportsDir: path.join(process.env.HOME, 'company', 'reports', 'triad'),
    maxFailures: 3,
  });
  console.log('[runner] task-loader results:', JSON.stringify(taskResults));
}

(async () => {
  await maybeRunTaskLoader();
  main();
})();
