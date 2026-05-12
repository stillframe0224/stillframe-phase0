#!/usr/bin/env node
import assert from 'node:assert/strict';

process.env.RWL_RUNNER_SKIP_MAIN = '1';

const {
  isRunnerInternalPath,
  validateTaskSchema,
  validateTriadReviewShape,
} = await import('./runner.js');

const baseTask = {
  id: '20260428-120000-contract-fixture',
  goal: 'Validate RWL task contract fixture',
  est_minutes: 10,
  dod: ['npm run build 通過'],
  evidence_paths: ['reports/triad/20260428-120000-contract-fixture.md'],
  allowed_files: ['app/page.tsx', 'reports/triad/20260428-120000-contract-fixture.md'],
  verification_commands: ['npm run build'],
  triad_review: {
    contract: 'PENDING',
    regression: 'PENDING',
    safety: 'PENDING',
    reviewed_commit: null,
    report_path: 'reports/triad/20260428-120000-contract-fixture.md',
  },
  created_at: '2026-04-28T12:00:00+09:00',
  status: 'queue',
};

assert.deepEqual(validateTaskSchema(baseTask), [], 'pending triad scaffold is valid before execution');

{
  const invalid = { ...baseTask };
  delete invalid.allowed_files;
  assert.match(validateTaskSchema(invalid).join('\n'), /missing task\.allowed_files/);
}

{
  const invalid = { ...baseTask, allowed_files: [] };
  assert.match(validateTaskSchema(invalid).join('\n'), /allowed_files must contain at least one path/);
}

{
  const invalid = { ...baseTask };
  delete invalid.verification_commands;
  assert.match(validateTaskSchema(invalid).join('\n'), /missing or non-array task\.verification_commands/);
}

{
  const invalid = { ...baseTask };
  delete invalid.triad_review;
  assert.match(validateTaskSchema(invalid).join('\n'), /missing task\.triad_review/);
}

assert.deepEqual(
  validateTriadReviewShape(baseTask.triad_review, { allowPending: true }),
  [],
  'PENDING axes are allowed before execution'
);
assert.match(
  validateTriadReviewShape(baseTask.triad_review, { allowPending: false }).join('\n'),
  /triad_review\.contract must be one of PASS\|WARN\|FAIL/,
  'PENDING axes are incomplete after execution'
);

assert.equal(isRunnerInternalPath('.rwl/Current/20260428-120000-contract-fixture.json'), true);
assert.equal(isRunnerInternalPath('.claude/results/20260428-120000-contract-fixture_result.json'), true);
assert.equal(isRunnerInternalPath('app/page.tsx'), false);

console.log('task schema contract tests passed');
