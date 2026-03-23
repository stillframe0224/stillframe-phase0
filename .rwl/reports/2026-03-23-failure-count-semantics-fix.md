# failure_count セマンティクス修正

Date: 2026-03-23

## 旧挙動（問題）

```
execution成功 + triad_gate失敗 → quarantine → return（failure_count据え置き）
execution成功 + triad_gate成功 → markDone → failure_count = 0
execution失敗                  → failure_count++
```

triad_gate が常にブロックするケースでは failure_count が永久にリセットされず、
成功タスクが回り続けても circuit breaker に向かって failure_count が単調増加する。

## 新挙動

```
execution成功 → failure_count = 0（即座、governance判定の前に）
  + governance成功 → markDone
  + governance失敗 → quarantine（failure_countは0のまま）
execution失敗 → failure_count++
```

### 設計原則

| レイヤー | 何を表すか | failure_count への影響 |
|----------|-----------|----------------------|
| execution_result | 機械的成功/失敗（exit code, build, test） | 唯一の影響源 |
| governance_result | triad/gate/process完了度 | 影響なし |

### failure_count セマンティクス（修正後）

- **インクリメント**: execution failure（非ゼロ exit, timeout, crash）のみ
- **リセット**: 任意の execution success で 0 にリセット（governance結果は無関係）
- **governance-onlyの問題**: quarantine されるが failure_count は増えない

## 変更ファイル

| ファイル | 変更内容 |
|---------|---------|
| `.rwl/runner.js` | main() の結果評価ブロックを2レイヤーに分離。failure_count = 0 を governance判定の前に移動 |
| `.rwl/test-failure-count-semantics.mjs` | 新規。6シナリオのテスト |
| `.rwl/reports/2026-03-23-failure-count-semantics-fix.md` | 本ドキュメント |

## テスト結果

```
Scenario 1: exec success + gov success     → fc=0, markDone    ✅
Scenario 2: exec success + triad missing   → fc=0, quarantine  ✅
Scenario 2b: exec success + file mismatch  → fc=0, quarantine  ✅
Scenario 3: exec failure                   → fc++              ✅
Scenario 3b: 5 consecutive failures        → fc=5 (breaker)    ✅
Scenario 4: recovery after 4 failures      → fc=0              ✅
```

## 残存エッジケース

- `quarantine` 状態のタスクは手動レビューが必要（変更なし）
- 大量の governance-only quarantine が溜まる場合は別途 Quarantine 自動クリーンを検討
- triad_review 自動付与（Phase 3）が実装されれば governance block 自体が減少する見込み
