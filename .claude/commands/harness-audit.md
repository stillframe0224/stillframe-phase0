---
description: Claude Code設定の軽量セルフ診断。hooks・rules・env・MCP・permissionsの整合性を確認する。
---

## Harness Audit — 自己診断チェックリスト

以下の項目を順に確認し、結果を表形式で報告してください。

### 1. Hook 登録チェック

- `.claude/settings.json` の `hooks.PreToolUse` に `block-git-ops.sh` が登録されているか
- スクリプトファイルが実在するか（`ls .claude/hooks/scripts/block-git-ops.sh`）
- `bash -n` で構文エラーがないか

### 2. Rules チェック

- `.claude/rules/` 配下のファイル一覧を取得
- 各ファイルの先頭行を表示して目的を確認

### 3. Environment 変数チェック

- `.claude/settings.json` の `env` ブロックを読み取り
- 必須キー: `MAX_THINKING_TOKENS`, `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE`, `CLAUDE_CODE_SUBAGENT_MODEL`
- Hook profile: `STILLFRAME_HOOK_PROFILE`, `STILLFRAME_DISABLED_HOOKS`

### 4. MCP サーバーチェック

- `~/.claude.json` のグローバルMCP一覧
- `.claude/settings.json` のプロジェクトMCP一覧
- `disabledMcpServers` で無効化済みの一覧

### 5. Permissions チェック

- `allow` リストの内容
- `deny` リストの内容
- 既知の危険パターン（`rm -rf`, `sudo`, `curl`, `wget`）がdenyに含まれているか

### 6. Lessons システムチェック

- `.rwl/lessons/` ディレクトリの存在
- `system-addon.txt` が存在し空でないか
- `recent-failures.md` と `recent-success-patterns.md` の件数

## 出力フォーマット

| カテゴリ | 項目 | 状態 | 備考 |
|----------|------|------|------|
| Hook | block-git-ops 登録 | ✅/❌ | ... |
| Hook | スクリプト構文 | ✅/❌ | ... |
| Rules | ファイル数 | N件 | ... |
| Env | 必須キー | ✅/❌ | ... |
| MCP | グローバル数 | N件 | ... |
| MCP | 無効化数 | N件 | ... |
| Permissions | deny安全性 | ✅/❌ | ... |
| Lessons | addon有効 | ✅/❌ | ... |

問題が見つかった場合は修正提案を添えてください。
