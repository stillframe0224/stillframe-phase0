---
description: StillFrame v4 ハーネスのスモークテスト。設定・hook・runner・lessons・commandsの動作確認を一括実行する。
---

## StillFrame v4 Smoke Test

以下のスクリプトを順に実行し、結果を報告してください。

### Phase 1: 基本健全性確認

```bash
bash -c '
echo "=== 1. settings ==="
python3 -m json.tool .claude/settings.json >/dev/null 2>&1 && echo "OK settings" || echo "NG settings"
echo ""
echo "=== 2. hook syntax ==="
bash -n .claude/hooks/scripts/block-git-ops.sh && echo "OK hook" || echo "NG hook"
echo ""
echo "=== 3. runner syntax ==="
node --check .rwl/runner.js && echo "OK runner" || echo "NG runner"
echo ""
echo "=== 4. lessons files ==="
for f in .rwl/lessons/recent-failures.md .rwl/lessons/recent-success-patterns.md .rwl/lessons/system-addon.txt; do
  [ -f "$f" ] && echo "OK $f" || echo "NG $f"
done
echo ""
echo "=== 5. commands ==="
for f in entire nightly-review plan-then-act spa-day task-create harness-audit quality-gate smoke-test; do
  [ -f ".claude/commands/${f}.md" ] && echo "OK ${f}" || echo "NG ${f}"
done
'
```

合格条件: NG が 0 件

### Phase 2-5: Hook・Profile・Commands・Lessons

```bash
bash .claude/hooks/scripts/smoke-phase2.sh
```

合格条件: `FAIL: 0` かつ `✅ ALL PHASES PASSED`

### 最終判定

全 Phase で NG / FAIL が 0 なら **✅ SMOKE PASSED** と報告。
1つでも失敗があれば **❌ SMOKE FAILED** と報告し、修正提案を添えてください。
