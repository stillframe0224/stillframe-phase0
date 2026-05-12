#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';

const runnerSource = fs.readFileSync(new URL('./runner.js', import.meta.url), 'utf8');

assert.equal(
  runnerSource.includes("'--model', 'claude-opus-4-7'"),
  true,
  'runner must pin Claude Opus 4.7 explicitly so the model RWL uses is auditable and does not silently drift with CLI defaults'
);

assert.equal(
  runnerSource.includes("'--fallback-model', 'claude-opus-4-6'"),
  true,
  'runner must keep Opus 4.6 as fallback so overload of Opus 4.7 does not stop nightly execution (4.6 was the working baseline through 2026-05-06)'
);

console.log('runner model pin test passed');
