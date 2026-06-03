#!/usr/bin/env node
/**
 * Test: Claude runner command uses bare mode only when API-key auth is present.
 *
 * Claude Code --bare intentionally skips OAuth/keychain auth. The RWL runner
 * must keep --bare for API-key environments while allowing the user's logged-in
 * Claude Max/OAuth session to run without tripping "Not logged in".
 */

import assert from 'node:assert/strict';

process.env.RWL_RUNNER_SKIP_MAIN = '1';

const { buildClaudeCommand, shouldUseBareClaude } = await import('./runner.js');

console.log('\n=== OAuth/keychain environments do not use --bare ===');
{
  const env = {};
  assert.equal(shouldUseBareClaude(env), false);
  assert.equal(buildClaudeCommand('Return OK only.', env).includes(' --bare'), false);
  assert.equal(buildClaudeCommand('Return OK only.', env).includes('/usr/local/bin/claude'), true);
  console.log('PASS');
}

console.log('\n=== API-key environments preserve --bare ===');
{
  const env = { ANTHROPIC_API_KEY: 'present' };
  assert.equal(shouldUseBareClaude(env), true);
  assert.equal(buildClaudeCommand('Return OK only.', env).includes(' --bare'), true);
  console.log('PASS');
}

console.log('\n=== explicit override can disable --bare ===');
{
  const env = { ANTHROPIC_API_KEY: 'present', RWL_CLAUDE_BARE: '0' };
  assert.equal(shouldUseBareClaude(env), false);
  assert.equal(buildClaudeCommand('Return OK only.', env).includes(' --bare'), false);
  console.log('PASS');
}

console.log('\n=== explicit override can force --bare ===');
{
  const env = { RWL_CLAUDE_BARE: '1' };
  assert.equal(shouldUseBareClaude(env), true);
  assert.equal(buildClaudeCommand('Return OK only.', env).includes(' --bare'), true);
  console.log('PASS');
}

console.log('\n=== prompt metacharacters are shell-quoted ===');
{
  const prompt = 'Fence it with ```json ... ``` and say {"status":"completed|partial"}; do not run $(echo bad)';
  const command = buildClaudeCommand(prompt, {});
  assert.doesNotMatch(command, /-p "/, 'prompt must not be embedded in double quotes');
  assert.match(command, /-p '/, 'prompt should be single-quoted for shell safety');
  assert.match(command, /`{3}json/, 'prompt content should be preserved');
  assert.match(command, /\$\(echo bad\)/, 'literal command substitution text should be preserved inside quotes');
  console.log('PASS');
}

console.log('\n=== ALL TESTS PASSED ===\n');
