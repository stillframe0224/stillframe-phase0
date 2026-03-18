#!/bin/bash
HOOK=".claude/hooks/scripts/block-git-ops.sh"
output=$(echo '{"tool_input":{"command":"bash -n .claude/hooks/scripts/block-git-ops.sh"}}' | bash "$HOOK" 2>&1)
code=$?
echo "Test 9 (git in filename): exit=$code (expected 0)"
if [ "$code" -eq 0 ]; then echo "PASS"; else echo "FAIL: $output"; fi
