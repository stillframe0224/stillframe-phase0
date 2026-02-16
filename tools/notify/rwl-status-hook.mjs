#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';

if (process.env.RWL_NOTIFY !== '1') {
  process.exit(0);
}

const root = process.cwd();
const statusPath = process.argv[2] || path.join(root, '.rwl', 'status.json');
const logsDir = path.join(root, '.rwl', 'logs');
const seenPath = path.join(logsDir, '.notify-seen.json');
const notifier = path.join(root, 'tools', 'notify', 'ntfy.mjs');

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function mapPriority(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'critical') return '4';
  if (s === 'warning') return '3';
  if (s === 'done' || s === 'complete') return '3';
  return '3';
}

try {
  fs.mkdirSync(logsDir, { recursive: true });

  const status = readJson(statusPath, null);
  if (!status) process.exit(0);

  const statusName = String(status.status || '').toLowerCase();
  if (!statusName) process.exit(0);

  const taskId = String(status.task_id || status.phase || 'unknown');
  const dedupKey = `${taskId}:${statusName}`;

  const seen = readJson(seenPath, {});
  if (seen[dedupKey]) {
    process.exit(0);
  }

  const title = `RWL: ${statusName}`;
  const priority = mapPriority(statusName);
  const reportPath = status.report_path || '-';
  const lastError = String(status.last_error || '').replace(/\s+/g, ' ').slice(0, 180);
  const message = `task=${taskId} report=${reportPath} err=${lastError || '-'}`;

  const res = spawnSync('node', [notifier, '--title', title, '--priority', priority, '--message', message], {
    stdio: ['ignore', 'ignore', 'inherit'],
    env: process.env,
  });

  if (res.status === 0) {
    seen[dedupKey] = new Date().toISOString();
    fs.writeFileSync(seenPath, JSON.stringify(seen, null, 2) + '\n');
  } else {
    console.error('[rwl-notify] warn notify failed');
  }
} catch (error) {
  console.error(`[rwl-notify] warn hook error: ${error?.message || String(error)}`);
}

process.exit(0);
