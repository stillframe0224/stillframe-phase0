# Task: Waitlistフォームをモバイルで縦積み表示にしてCTA押下率の低下を防ぐ
**ID**: 20260219-080600-waitlist-mobile-layout
**Date**: 2026-02-28 JST
**Est**: 15min / **Actual**: 10min
**Session**: nightly

## 変更ファイル
- `app/components/Waitlist.tsx`: inline flex-wrap → Tailwind `flex-col sm:flex-row` に変更。モバイルでinput/CTAが縦積み＋フル幅に。

## 変更内容
- `form` の inline style (`display:flex; gap:10; flexWrap:wrap`) を Tailwind クラス `flex flex-col sm:flex-row gap-2.5` に置換
- `input` に `w-full sm:flex-1 sm:min-w-0` を追加し、モバイルでフル幅表示
- `PrimaryButton` に `w-full sm:w-auto` を追加し、モバイルでフル幅のタップターゲットを確保
- inline style の `flex` プロパティを削除（Tailwind クラスに移行）

## ビルド結果
exit code: 0（成功）

## PR
（作成予定）

## 動作確認
- モバイル（< 640px）: input と CTA ボタンが縦に積まれ、両方フル幅
- デスクトップ（≥ 640px）: 横並びレイアウト維持
