---
description: 朝のRWL夜間ランナー結果レビュー。ログを読み、成功/失敗を判定し、次のアクションを提案する。
argument-hint: [日付(省略時は昨夜)]
---

## 手順

1. ログファイルを読む:
   - `cat .rwl/logs/runner.jsonl | tail -30`
   - `cat .rwl/status.json`
   - `.state/night_state.json` があれば読む
   - `.rwl/lessons/recent-failures.md` を読む
   - `.rwl/sessions/` 配下の直近ファイルがあれば読む

2. 以下を判定して報告:
   - 昨夜のタスク実行数
   - 成功/失敗/スキップの内訳
   - circuit breaker の状態（failure_count）
   - 最後に完了したタスクID
   - lessonsから学習すべきパターン

3. 失敗がある場合:
   - エラー分類（retryable / permanent）を判定
   - permanentなら原因と修正案を提示
   - retryableなら「今夜再試行で問題ない」と報告

4. 次のアクション提案:
   - Current/ に残っているタスクがあれば内容を要約
   - Queue/ に次のタスクがあれば優先順位を確認
   - failure_count が 3 以上なら手動介入を推奨

## 出力フォーマット

結論ファースト。1行目に ✅ or ❌ + 要約。詳細は散文で。
