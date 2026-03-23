---
description: リポジトリ全体のコンテキストを読み込んでからタスクに取り組む。大きな変更や初見コードベース理解に使う。
argument-hint: <タスク内容>
---

## 読み込み手順（この順番で実行）

1. `CLAUDE.md` を読む
2. `.claude/rules/` 配下を全て読む
3. `.claude/skills/` 配下を全て読む（あれば）
4. ディレクトリ構造を把握: `find . -maxdepth 2 -type f | head -80`
5. `package.json`, `tsconfig.json`, `next.config.*` 等の設定ファイルを読む
6. `.github/workflows/` の一覧を把握する（あれば）
7. 既存コードを検索して関連実装を把握する（search-first原則）

## 読み込み完了後

- 読み込んだ内容の要約を3行で報告（確認のため）
- その上で $ARGUMENTS のタスクに着手
- タスク実行中も rules/ の制約に従うこと

## 注意

- このコマンドはコンテキストを大量消費する。小さいタスクには使うな
- コンテキスト50%到達で自動compactが走る
