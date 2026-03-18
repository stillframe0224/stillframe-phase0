#!/bin/bash
# Test the block-git-ops hook with 8 patterns
HOOK=".claude/hooks/scripts/block-git-ops.sh"
pass=0
fail=0

run_test() {
  local num="$1"
  local input="$2"
  local expect="$3"
  local desc="$4"

  output=$(echo "$input" | bash "$HOOK" 2>&1)
  actual=$?

  if [ "$actual" -eq "$expect" ]; then
    echo "✅ Test $num: $desc (exit=$actual)"
    pass=$((pass+1))
  else
    echo "❌ Test $num: $desc — expected exit=$expect, got exit=$actual"
    echo "   output: $output"
    fail=$((fail+1))
  fi
}

run_test 1 '{"tool_input":{"command":"git push --force origin main"}}' 2 "git push --force (DENY)"
run_test 2 '{"tool_input":{"command":"npm run test"}}' 0 "npm run test (ALLOW)"
run_test 3 '{"tool_input":{"command":"git log --oneline -5"}}' 0 "git log (ALLOW)"
run_test 4 '{"tool_input":{"command":"git reset --hard HEAD"}}' 2 "git reset --hard (DENY)"
run_test 5 '{"tool_input":{"command":"git commit -m \"fix: something\""}}' 2 "git commit (DENY)"
run_test 6 '{"tool_input":{"command":"git diff HEAD~1"}}' 0 "git diff (ALLOW)"
run_test 7 '{"tool_input":{"command":"echo ok && git push origin main"}}' 2 "compound git push (DENY)"
run_test 8 '{"tool_input":{"command":"git status && git log --oneline -3"}}' 0 "compound readonly (ALLOW)"

echo ""
echo "Results: $pass passed, $fail failed"
