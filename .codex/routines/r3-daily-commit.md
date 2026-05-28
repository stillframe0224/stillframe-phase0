# R3: Daily Commit Summary

**Trigger**: Schedule, daily at 08:30 JST
**Project**: stillframe-phase0
**Execution mode**: Worktree

## Objective

昨日のcommit logを取得し、日本語1段落で要約、`reports/daily-summary.md` に APPEND する。

## Steps

### 1. 日付特定

YYYY-MM-DD format、JST基準で「昨日」を計算。

### 2. Commit取得

```bash
cd /Users/array0224/stillframe-phase0  # worktree path内で
git log --oneline --after="YESTERDAY 00:00" --before="TODAY 00:00" --all
```

YESTERDAY / TODAY は JST基準の実日付に置換。

### 3. 要約生成

#### Commitがある場合
- 各commit messageを丁寧に読む
- 何の機能が追加された/何が修正されたかを1段落の日本語で要約
- 2-4文を厳守、簡潔に

#### Commitがない場合
- 要約テキストは「作業なし」

### 4. APPEND

ファイル: `reports/daily-summary.md`
形式:

```
## YYYY-MM-DD

要約文

```

(要約後に空行1つ、次のエントリの前に)

### 5. ディレクトリ確認

`reports/` ディレクトリが存在しなければ作成。

### 6. Commit & Push

- branch: main(直push想定)
- commit message: `chore: daily-summary YYYY-MM-DD`
- main保護でblockされたらPRに切り替え(`docs/daily-summary-YYYY-MM-DD` branch、PR作成)

## Constraints

- 日本語で書く
- 必ず APPEND、上書きしない
- 見出しの日付は「昨日」(要約対象の日付)、「今日」ではない
- 余計なコメントなし、フォーマット通りに append して finish
- 秘密値や個人情報を要約に含めない

## Safety

- git log 取得失敗時: exit、架空内容生成禁止
- reports/daily-summary.md の既存内容を破壊する書き込み禁止(必ずAPPEND)
- push失敗時: ローカル変更を残し報告(無理に再試行しない)
- 秘密値・個人情報を要約に含めない
