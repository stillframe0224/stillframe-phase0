# stillframe-phase0 — Agent Operating Notes

## Project Overview
- RWL(自律実行ループ)システム、launchdベース
- ALLAY worldbuilding project関連
- 個人プロジェクト、ソロ運用

## Test commands
- (リポにテストがあれば追記)

## RWL System Reference

### State files
- Status: `.rwl/status.json`(failure_count / max_failures / last_error / last_run_at)
- Events: `.rwl/EVENTS.jsonl`(triad_review_missing 等のガバナンスイベント)
- DONE: `.rwl/DONE.json`(成功タスク履歴)
- Runner logs: `.rwl/logs/runner.jsonl`
- Old task_done logs: `.rwl/logs/events.jsonl`(2026-03-18以降は非canonical)

### Night run logs(別パス)
- `/Users/array0224/stillframe/reports/rwl/night/run.jsonl`

### Stale-worktree gate(2026-05-18 run.sh実装)
- センチネル: `.rwl/HOLD/stale_live_worktree`
- root_causes: `stale_live_worktree`, `stale_live_worktree_origin_unreachable`, `branch_pin_drift`, `branch_pin_misconfigured`
- D3自己解消: gate通過時に自動消去、手動unblock不要

### Live worktree check(2026-05-16追加)
- branch: `git -C /Users/array0224/stillframe-phase0 branch --show-current`
- HEAD vs origin/main: `git -C /Users/array0224/stillframe-phase0 fetch -q origin main && git -C /Users/array0224/stillframe-phase0 rev-parse HEAD origin/main`
- 不一致なら「⚠️ live worktree が origin/main 未追従」を要対応に記載

## Daily Check (R2) Specification
詳細仕様: `.codex/routines/r2-daily-secretary.md` を参照。

毎朝 08:15 JST に以下を集約:
1. RWL local state(最優先)
2. GitHub CI(`stillframe0224/stillframe-phase0`)
3. Vercel deploy-smoke
4. n8n local logs(`/Users/array0224/.n8n/`)
5. Supabase mail(Gmail MCP)
6. Skill Candidates(`/Users/array0224/.claude/skill-candidates/`)

出力: `/Users/array0224/company/secretary/daily-checks/YYYY-MM-DD.md`(JSTの今日)

実行モード: **Local**(横断パスアクセスとMCP必要)

## Daily Commit Summary (R3) Specification
詳細仕様: `.codex/routines/r3-daily-commit.md` を参照。

毎朝 08:30 JST に昨日のcommit要約を生成:
- 範囲: yesterday 00:00 JST 〜 today 00:00 JST
- 出力: `reports/daily-summary.md` (APPEND)
- 言語: 日本語、2-4文
- リポ内ファイル変更のみなのでWorktree mode可

## Constraints

### Git/PR
- main保護方針: (要確認、テスト後追記)
- 副作用が小さい変更(reports/ APPEND)は直push想定
- それ以外はPR運用

### Security
- 秘密値の出力・コミット禁止
- gitleaks未導入なら手動確認、tokenを.envやログに露出させない

### Timezone
- JST(Asia/Tokyo, UTC+9)基準
- ファイル名・日付表記は JST の今日

## Safety guards
- ファイル取得失敗時: 架空生成せず exit、明示報告
- 横断アクセス失敗時: Gmail MCP未接続 / n8n停止 / ファイル消失 を区別して報告
- 推測でメール状態やRWL状態を作らない
- 既存ファイル上書き時: git diff確認後コミット
