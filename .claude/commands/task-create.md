---
description: RWLタスクファイルを作成する。research/implementの分離を強制する。
argument-hint: <タスク概要>
---

## まずユーザーにインタビューする（AskUserQuestion使用）

以下を順に聞く:
1. タスクの目的（1文で）
2. タスクタイプ: research or implement?
3. implementの場合: 具体的な完了条件（テストコマンド、期待出力）
4. 対象リポジトリ/ディレクトリ

## タスクファイル生成

ファイル名: `YYYYMMDD-HHmmSS-<slug>.md`、保存先: `.rwl/Queue/`

### research テンプレート

```
# <タスク名>

type: research
status: queued
created: <ISO datetime>

## Goal
<1文の目的>

## Questions
* <調査すべき問い>

## Scope
<調査範囲の制約>

## Output
.rwl/Research/<slug>.md に調査結果を書き出す
```

### implement テンプレート

```
# <タスク名>

type: implement
status: queued
created: <ISO datetime>

## Goal
<1文の目的>

## DoD (Definition of Done)
* [ ] <具体的な完了条件>
* [ ] テスト: <テストコマンド> がパスする

## Constraints
* <禁止事項>

## Files
* 変更対象: <ファイルパス>
```

## 最後に
作成したファイルの内容を表示して確認を求める。「Queue に入れました。次回ランナー実行対象です。」と報告。
