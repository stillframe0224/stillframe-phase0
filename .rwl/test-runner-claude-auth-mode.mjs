#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';

const runnerSource = fs.readFileSync(new URL('./runner.js', import.meta.url), 'utf8');

assert.equal(
  runnerSource.includes('--output-format text --bare'),
  false,
  'runner must not hardcode --bare: --bare ignores Claude subscription auth and requires a separate API key path'
);

assert.equal(
  runnerSource.includes('claude -p "${prompt}"'),
  false,
  'runner must pass the prompt as an argv value, not interpolate it into a shell string that breaks on JSON quotes'
);

assert.equal(
  runnerSource.includes("relPath.startsWith('.claude/results/')"),
  true,
  'runner result sidecars under .claude/results must be ignored as internal artifacts during file-scope verification'
);

console.log('runner claude auth mode test passed');
