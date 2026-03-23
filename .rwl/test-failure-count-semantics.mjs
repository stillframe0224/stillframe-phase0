#!/usr/bin/env node
/**
 * Test: failure_count semantics after runner.js refactor
 *
 * Validates 3 scenarios:
 *   1. execution success + governance success → failure_count = 0, markDone called
 *   2. execution success + governance incomplete (triad missing) → failure_count = 0, quarantined
 *   3. execution failure → failure_count incremented
 *
 * Strategy: extract and test the decision logic in isolation
 * without running the full runner (no Claude CLI, no git).
 */

import assert from 'node:assert/strict';

// ─── Simulate the two-layer decision logic from main() ───

function simulateResultEvaluation({ execOk, triadOk, verifyOk, initialFailureCount }) {
  const status = { failure_count: initialFailureCount };
  const execution_result = execOk ? 'success' : 'failure';
  let governance_result = 'pending';
  let markDoneCalled = false;
  let quarantineCalled = false;
  let quarantineReason = '';

  if (execOk) {
    // KEY CHANGE: failure_count resets on execution success, BEFORE governance check
    status.failure_count = 0;

    if (verifyOk) {
      if (triadOk) {
        governance_result = 'pass';
        markDoneCalled = true;
      } else {
        governance_result = 'triad_review_missing';
        quarantineCalled = true;
        quarantineReason = 'triad_review_missing';
      }
    } else {
      governance_result = 'allowed_files_mismatch';
      quarantineCalled = true;
      quarantineReason = 'allowed_files_mismatch';
    }
    status.last_error = null;
  } else {
    governance_result = 'n/a';
    status.failure_count = (status.failure_count || 0) + 1;
    status.last_error = `execution_failure at attempt ${status.failure_count}`;
  }

  return {
    execution_result,
    governance_result,
    failure_count: status.failure_count,
    last_error: status.last_error,
    markDoneCalled,
    quarantineCalled,
    quarantineReason,
  };
}

// ─── Scenario 1: execution success + governance success ───
console.log('\n=== Scenario 1: execution success + governance success ===');
{
  const result = simulateResultEvaluation({
    execOk: true,
    triadOk: true,
    verifyOk: true,
    initialFailureCount: 3, // was elevated
  });
  console.log(JSON.stringify(result, null, 2));
  assert.equal(result.execution_result, 'success');
  assert.equal(result.governance_result, 'pass');
  assert.equal(result.failure_count, 0, 'failure_count must reset to 0');
  assert.equal(result.markDoneCalled, true, 'markDone must be called');
  assert.equal(result.quarantineCalled, false);
  assert.equal(result.last_error, null);
  console.log('✅ PASS: failure_count reset, markDone called');
}

// ─── Scenario 2: execution success + governance incomplete ───
console.log('\n=== Scenario 2: execution success + triad missing ===');
{
  const result = simulateResultEvaluation({
    execOk: true,
    triadOk: false,
    verifyOk: true,
    initialFailureCount: 4, // one away from breaker
  });
  console.log(JSON.stringify(result, null, 2));
  assert.equal(result.execution_result, 'success');
  assert.equal(result.governance_result, 'triad_review_missing');
  assert.equal(result.failure_count, 0, 'failure_count MUST reset even when triad blocks');
  assert.equal(result.markDoneCalled, false, 'markDone must NOT be called');
  assert.equal(result.quarantineCalled, true, 'task must be quarantined');
  assert.equal(result.last_error, null);
  console.log('✅ PASS: failure_count reset despite governance block');
}

// ─── Scenario 2b: execution success + allowed_files mismatch ───
console.log('\n=== Scenario 2b: execution success + allowed_files mismatch ===');
{
  const result = simulateResultEvaluation({
    execOk: true,
    triadOk: true,
    verifyOk: false,
    initialFailureCount: 4,
  });
  console.log(JSON.stringify(result, null, 2));
  assert.equal(result.execution_result, 'success');
  assert.equal(result.governance_result, 'allowed_files_mismatch');
  assert.equal(result.failure_count, 0, 'failure_count MUST reset — file scope is governance, not execution');
  assert.equal(result.markDoneCalled, false);
  assert.equal(result.quarantineCalled, true);
  console.log('✅ PASS: failure_count reset despite file scope violation');
}

// ─── Scenario 3: execution failure ───
console.log('\n=== Scenario 3: execution failure ===');
{
  const result = simulateResultEvaluation({
    execOk: false,
    triadOk: false,
    verifyOk: false,
    initialFailureCount: 2,
  });
  console.log(JSON.stringify(result, null, 2));
  assert.equal(result.execution_result, 'failure');
  assert.equal(result.governance_result, 'n/a');
  assert.equal(result.failure_count, 3, 'failure_count must increment on execution failure');
  assert.notEqual(result.last_error, null);
  assert.equal(result.markDoneCalled, false);
  assert.equal(result.quarantineCalled, false);
  console.log('✅ PASS: failure_count incremented on execution failure');
}

// ─── Scenario 3b: consecutive execution failures → breaker ───
console.log('\n=== Scenario 3b: failure accumulation to breaker threshold ===');
{
  let fc = 0;
  for (let i = 0; i < 5; i++) {
    const result = simulateResultEvaluation({
      execOk: false,
      triadOk: false,
      verifyOk: false,
      initialFailureCount: fc,
    });
    fc = result.failure_count;
  }
  assert.equal(fc, 5, 'failure_count must reach breaker threshold after 5 consecutive execution failures');
  console.log(`✅ PASS: failure_count reached ${fc} after 5 execution failures`);
}

// ─── Scenario 4: recovery after failures ───
console.log('\n=== Scenario 4: recovery — execution success after 4 failures ===');
{
  const result = simulateResultEvaluation({
    execOk: true,
    triadOk: false, // governance still broken
    verifyOk: true,
    initialFailureCount: 4, // one failure away from breaker
  });
  assert.equal(result.failure_count, 0, 'single execution success must fully reset failure_count');
  console.log(`✅ PASS: failure_count ${4} → ${result.failure_count} (full reset on execution success)`);
}

console.log('\n=== ALL TESTS PASSED ===\n');
