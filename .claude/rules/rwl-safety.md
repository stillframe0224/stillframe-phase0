--- globs: .rwl/** ---

# RWL 安全ルール

## Git操作の禁止

以下のgitコマンドは絶対に実行しない。ブランチ操作とコミットはrunner.jsが管理する。

- git checkout
- git switch
- git reset
- git restore
- git rebase
- git commit
- git push

## ファイル保護

- `.rwl/logs/` 配下のファイル（runner.jsonl等）は編集・削除しない
- `.rwl/DONE.json` のstatusフィールドは直接書き換えない（runner.jsのmarkDone/markBlocked経由のみ）
- `.rwl/status.json` はrunner.jsが排他管理する

## タスクライフサイクル

- Current/ のタスクファイルは内容を読むのみ。移動・削除はrunner.jsが行う
- Done/ のタスクファイルは変更しない（証跡として保存）
