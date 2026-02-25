# Bundle Summary CLI

## Bundle 取得
1. SHINEN を `?debug=1` 付きで開く
2. 通常 Export を実行
3. `~/Downloads/shinen-export-bundle-*.jsonl` を取得

## CLI 実行
```bash
node scripts/shinen_bundle_summary.mjs ~/Downloads/shinen-export-bundle-<timestamp>.jsonl
```

任意で:
```bash
npm run bundle:summary -- ~/Downloads/shinen-export-bundle-<timestamp>.jsonl
```

## 出力内容
- `File / Lines / ParseErrors / ParsedJSON`
- `Build`（`meta` から `commit/version`）
- 主要イベント件数
  - `save_guard_applied`
  - `migration_start / migration_fix / migration_action_enqueued / migration_done`
  - `embed_load_start / embed_load_ok / embed_load_timeout`
  - `thumb_error / open_click`
- `TopSaveGuardReasons`
- `TopEmbedTimeouts`（`provider @ domain`）

## 運用目安
- `embed_load_timeout` が増える:
  - provider 側の不安定化、埋め込みブロック、ブラウザ側制約の可能性
- `save_guard_applied` が増える:
  - 保存入口で URL/type/source の回帰が起きている可能性
- `migration_fix` が起動のたびに増える:
  - 旧データ残存、または migration version key の不安定化の可能性
