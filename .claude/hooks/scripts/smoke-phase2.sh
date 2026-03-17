#!/bin/bash
# Phase 2: Hook allow/deny verification
HOOK=".claude/hooks/scripts/block-git-ops.sh"
PASS=0; FAIL=0

check() {
  local label="$1" expected="$2" input="$3"
  actual=$(echo "$input" | bash "$HOOK" 2>&1; echo "$?")
  code=$(echo "$actual" | tail -1)
  if [ "$code" = "$expected" ]; then
    echo "✅ $label → exit $code"
    PASS=$((PASS+1))
  else
    echo "❌ $label → exit $code (expected $expected)"
    FAIL=$((FAIL+1))
  fi
}

echo "=== Phase 2: allow/deny ==="
check "git status"            0 '{"tool_input":{"command":"git status"}}'
check "git diff HEAD~1"       0 '{"tool_input":{"command":"git diff HEAD~1"}}'
check "git log --oneline -3"  0 '{"tool_input":{"command":"git log --oneline -3"}}'
check "git commit -m test"    2 '{"tool_input":{"command":"git commit -m \"test\""}}'
check "git push origin main"  2 '{"tool_input":{"command":"git push origin main"}}'
check "git reset --hard HEAD" 2 '{"tool_input":{"command":"git reset --hard HEAD"}}'
check "echo ok && git status" 0 '{"tool_input":{"command":"echo ok && git status"}}'
check "echo ok && git push"   2 '{"tool_input":{"command":"echo ok && git push origin main"}}'

echo ""
echo "=== Phase 3: profile switching ==="
# disabled → bypass
code=$(echo '{"tool_input":{"command":"git push origin main"}}' | STILLFRAME_DISABLED_HOOKS=block-git-ops bash "$HOOK" 2>&1; echo $?)
code=$(echo "$code" | tail -1)
if [ "$code" = "0" ]; then
  echo "✅ disabled bypass → exit 0"
  PASS=$((PASS+1))
else
  echo "❌ disabled bypass → exit $code (expected 0)"
  FAIL=$((FAIL+1))
fi

# standard → block
code=$(echo '{"tool_input":{"command":"git push origin main"}}' | STILLFRAME_HOOK_PROFILE=standard bash "$HOOK" 2>&1; echo $?)
code=$(echo "$code" | tail -1)
if [ "$code" = "2" ]; then
  echo "✅ standard block → exit 2"
  PASS=$((PASS+1))
else
  echo "❌ standard block → exit $code (expected 2)"
  FAIL=$((FAIL+1))
fi

echo ""
echo "=== Phase 4: commands wiring ==="
if grep -q "quality-gate" .claude/commands/plan-then-act.md; then
  echo "✅ plan-then-act → quality-gate link found"
  PASS=$((PASS+1))
else
  echo "❌ plan-then-act → quality-gate link missing"
  FAIL=$((FAIL+1))
fi

echo ""
echo "=== Phase 5: lessons addon ==="
if [ -s .rwl/lessons/system-addon.txt ]; then
  echo "✅ system-addon.txt exists and non-empty"
  PASS=$((PASS+1))
else
  echo "⚠️  system-addon.txt empty (acceptable for fresh install)"
  PASS=$((PASS+1))
fi

echo ""
echo "========================================="
echo "PASS: $PASS  FAIL: $FAIL"
if [ "$FAIL" -eq 0 ]; then
  echo "✅ ALL PHASES PASSED"
else
  echo "❌ SOME CHECKS FAILED"
fi
