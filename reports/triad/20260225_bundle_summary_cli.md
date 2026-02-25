# 20260225 Bundle Summary CLI

## 目的
- `shinen-export-bundle-*.jsonl` を自動集計し、保存ガード・マイグレーション・embed障害などの運用イベントを即時把握できるようにする。

## 追加CLI
- 追加: `scripts/shinen_bundle_summary.mjs`
- 実行:
  - `node scripts/shinen_bundle_summary.mjs <bundle_path>`
  - `npm run bundle:summary -- <bundle_path>`
- 入力:
  - bundle JSONL（`kind=meta/card/diag` 混在）
- 出力:
  - `File / Lines / ParseErrors / ParsedJSON`
  - `Build`（commit/version）
  - 主要イベント件数
    - `save_guard_applied`
    - `migration_start/migration_fix/migration_action_enqueued/migration_done`
    - `embed_load_start/embed_load_ok/embed_load_timeout`
    - `thumb_error/open_click`
  - `TopSaveGuardReasons`
  - `TopEmbedTimeouts`（`provider @ domain`）
- 終了コード:
  - `1`: 引数なし/読取不可
  - `2`: parse成功行 0
  - `0`: 解析成功（壊れ行があっても集計可能なら成功）

## 主要イベントの見方
- `embed_load_timeout` が増加:
  - provider側の不安定、ブラウザ制約、CSP/追跡防止の影響を疑う。
- `save_guard_applied` が増加:
  - 保存入口の正規化ガードに引っかかる入力が増えており、入口回帰の兆候。
- `migration_fix` が毎回多い:
  - 旧データ残存、または migration version 管理の不安定化を疑う。

## テスト結果
- `npm run test:unit` ✅
- `node --test scripts/tests/shinen_bundle_summary.test.mjs` ✅
- `npm run build` ✅
- `bash scripts/tests/test_codex_headings.sh` ✅
- `bash scripts/tests/test_design_tokens.sh` ✅
