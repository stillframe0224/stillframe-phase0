---
description: CLAUDE.md と .claude/ 配下の定期棚卸し。矛盾・重複・肥大化を検出して整理案を出す。
---

## 手順

1. 以下を全て読む:
   - `CLAUDE.md`
   - `.claude/rules/` 配下の全ファイル
   - `.claude/skills/` 配下の全ファイル（あれば）
   - `.claude/commands/` 配下の全ファイル
   - `.claude/settings.json`

2. 以下を報告:
   - 行数: CLAUDE.md と各rules/skills/commandsの行数一覧
   - 矛盾: ファイル間で矛盾するルール
   - 重複: 複数ファイルに同じ内容が書かれている箇所
   - 肥大化: 200行を超えているファイル
   - 孤児: どこからも参照されていないskillsやrules
   - 不足: `.rwl/logs/runner.jsonl` と `.rwl/lessons/` の記録に基づいて、書かれていないが必要なルールを列挙する（推測ではなく記録ベースで）
   - MCP: 有効なMCP数とtool数。80 tools超えなら警告

3. 改善案を提示（差分で示す）

4. ユーザーの確認なしに変更しない。報告と提案のみ。
