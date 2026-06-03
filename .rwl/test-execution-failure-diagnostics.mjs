#!/usr/bin/env node
/**
 * Test: execution failures keep useful diagnostics without leaking secrets.
 *
 * R2 follow-up on 2026-06-03 found a breaker task with only attempt counters.
 * The runner should preserve enough redacted stderr/stdout tail to diagnose the
 * next failure without dumping full logs or credentials.
 */

import assert from 'node:assert/strict';

process.env.RWL_RUNNER_SKIP_MAIN = '1';

const { buildExecutionFailureDiagnostic } = await import('./runner.js');

console.log('\n=== execution failure diagnostic captures redacted tails ===');
{
  const diagnostic = buildExecutionFailureDiagnostic({
    message: 'Command failed: claude -p task',
    status: 1,
    signal: null,
    stdout: `${'x'.repeat(700)}\nANTHROPIC_API_KEY=sk-ant-test-secret\nlast line`,
    stderr: `first\nAuthorization: Bearer ghp_secret_token\nfatal: build failed`,
  });

  assert.equal(diagnostic.message, 'Command failed: claude -p task');
  assert.equal(diagnostic.status, 1);
  assert.equal(diagnostic.signal, null);
  assert.match(diagnostic.stdout_tail, /\[REDACTED\]/);
  assert.match(diagnostic.stderr_tail, /\[REDACTED\]/);
  assert.doesNotMatch(diagnostic.stdout_tail, /sk-ant-test-secret/);
  assert.doesNotMatch(diagnostic.stderr_tail, /ghp_secret_token/);
  assert.ok(diagnostic.stdout_tail.length <= 520);
  assert.ok(diagnostic.stderr_tail.length <= 520);
  console.log('PASS');
}

console.log('\n=== missing streams are represented safely ===');
{
  const diagnostic = buildExecutionFailureDiagnostic({ message: 'spawn timeout' });

  assert.equal(diagnostic.message, 'spawn timeout');
  assert.equal(diagnostic.status, null);
  assert.equal(diagnostic.signal, null);
  assert.equal(diagnostic.stdout_tail, '');
  assert.equal(diagnostic.stderr_tail, '');
  console.log('PASS');
}

console.log('\n=== ALL TESTS PASSED ===\n');
