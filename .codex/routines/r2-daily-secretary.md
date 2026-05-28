# R2: Daily Secretary Check

**Trigger**: Schedule, daily at 08:15 JST(local Mac time)
**Project**: stillframe-phase0
**Execution mode**: Local(必須、Worktreeでは横断パスアクセス不可)

## Output

`/Users/array0224/company/secretary/daily-checks/YYYY-MM-DD.md`(JSTの今日)

ディレクトリが存在しなければ作成。既存ファイルがあれば上書きOK(冪等)。

## Checks(並列実行)

### 1. RWL local state(最優先)

- Read `/Users/array0224/stillframe-phase0/.rwl/status.json`
  - failure_count / max_failures / last_error / last_run_at
  - failure_count >= 3 → 「⚠️ サーキットブレーカー近し」
  - failure_count >= max_failures → 「🚨 自律実行停止中」
- Read tail of `/Users/array0224/stillframe/reports/rwl/night/run.jsonl`
  および `/Users/array0224/stillframe-phase0/.rwl/logs/runner.jsonl`
  - timeout / runner_exit_nonzero / breaker_stop が直近24h → reason記載
  - outside_night_window は 08:00-21:59 JST の正常スキップとして扱う
- Read `/Users/array0224/stillframe-phase0/.rwl/DONE.json`
  - completed_at が直近7日以内のnightly entryを成功履歴として扱う
- Read `/Users/array0224/stillframe-phase0/.rwl/EVENTS.jsonl`
  - triad_review_missing / triad_review_stale → task_id と event_type 記載
- `.rwl/logs/events.jsonl` は旧形式、2026-03-18以降は canonical source ではない
  - 旧ログだけを根拠に「runner停止」「task_done未記録」と判定しない

### 1b. Live worktree branch/HEAD 乖離(2026-05-16追加)

- `git -C /Users/array0224/stillframe-phase0 branch --show-current`
- `git -C /Users/array0224/stillframe-phase0 fetch -q origin main`
- `git -C /Users/array0224/stillframe-phase0 rev-parse HEAD origin/main`
- HEADが origin/main と不一致 or branch が main 以外に pin → 「⚠️ live worktree が origin/main 未追従(PR修正が live に効かないリスク)」を要対応に記載、現branch と短縮SHA併記

### 1c. Stale-worktree gate(2026-05-18追加)

- `run.jsonl` 末尾の root_cause 確認:
  - `stale_live_worktree` / `stale_live_worktree_origin_unreachable` / `branch_pin_drift` / `branch_pin_misconfigured`
  - 直近24hにあれば「🚨 RWL gate 停止中(runner未実行)」要対応、root_cause と evidence(branch/head/origin_main) 併記
  - `status:"ok"` のガバナンス停止で failure_count は不変、breaker とは別物
  - センチネル: `/Users/array0224/stillframe-phase0/.rwl/HOLD/stale_live_worktree`
- 以下は実行継続の warning(要対応ではないが備考に記載):
  - origin_unreachable / origin_unreachable_no_ref / branch_pin_escape_active / stale_gate_disabled
- センチネルは gate 通過時に自動消去(D3自己解消)、手動unblock不要

### 2. GitHub CI

- `gh run list --repo stillframe0224/stillframe-phase0 --limit 10`
- `gh run list --repo stillframe0224/stillframe-phase0 --limit 10 --status failure`
  - 直近24h以内の失敗 → workflow名 / ブランチ / run ID 記載
- `gh pr list --repo stillframe0224/stillframe-phase0 --state open --limit 10`

### 3. Vercel deploy

- `gh run list --repo stillframe0224/stillframe-phase0 --limit 5 --workflow deploy-smoke`
- 失敗 → ブランチ名と run URL 記載
- deploy-smoke ワークフロー未発見時 → 直近 main push の run 確認

### 4. n8n local logs

- `/Users/array0224/.n8n/n8nEventLog.log` 末尾から `n8n.workflow.failed` を grep
  - 直近24h以内の失敗 → workflowName と errorMessage 記載
  - なし → 「✅ 直近24h失敗なし」
- `/Users/array0224/.n8n-failure-watch.log` 末尾10行確認
  - 直近24h以内のエラー → 記載
- `ps aux | grep n8n-failure-watch | grep -v grep`
  - プロセスなし → 「⚠️ failure-watch 停止中」要対応

### 5. Supabase mail(Gmail MCP)

- `from:(notify@supabase.io OR noreply@supabase.io) newer_than:1d`
- `from:supabase subject:(pause OR paused OR alert OR warning OR security OR billing OR downtime OR "free tier" OR "breaking change" OR migration) newer_than:7d`
- 重要メール種別(要対応): pause予告 / 容量超過 / セキュリティ通知 / migration / 請求
- なし → 「✅ 直近24h通知なし」
- Gmail MCP 未接続時 → 「⚠️ Gmail MCP未接続」記載、推測しない

### 6. Skill Candidates

- `/Users/array0224/.claude/skill-candidates/` の直近3日のファイル数を ls で確認

## Report Format(厳守)

```
=== Daily Check: YYYY-MM-DD ===
[RWL-local] {状態}: failure_count=N/M, last_run=YYYY-MM-DD HH:MM, last_result={success|failed}
[GitHub CI] ✅/❌ {直近24h失敗N件、詳細}
[Vercel] ✅/❌ {deploy-smoke結果、詳細}
[n8n] ✅/❌ {直近24h失敗N件、workflow名、エラー内容}
[Supabase mail] ✅/❌ {直近24h通知N件、件名/種別}
[Skill Candidates] ✅/❌ {N件}
要対応: {具体的アクションまたは「なし」}
```

## 要対応判定ルール

- RWL-local が失敗 → 常に要対応
- 要対応は具体的に: branch名/PRリンク/タスクID/run URL
- stillframe-phase0 関連の失敗 → 常に要対応
- gh CLI コマンド失敗 → 「gh CLI エラー」と記録、エラー内容明示
- n8n failure-watch プロセス停止 → 要対応
- Supabase pause予告 / security alert → 要対応
- Gmail MCP 未接続 → 要対応(手動確認促し)

## Safety

- ファイル取得失敗時は架空生成せず exit、明示報告
- 推測で状態を作らない
- 秘密値の出力禁止
