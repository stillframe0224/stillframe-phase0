# Task: Waitlistフォーム付近に安心感を高める補足文を追加し登録率改善の土台を作る
**ID**: 20260218-230114-waitlist-privacy-microcopy
**Date**: 2026-02-18 23:02 JST
**Est**: 25min / **Actual**: 18min
**Session**: nightly

## 変更ファイル
- /Users/array0224/stillframe-phase0/lib/copy.ts: waitlist文言に trust（安心感）メッセージを日英で追加
- /Users/array0224/stillframe-phase0/app/components/Waitlist.tsx: フォーム下に trust 文言を表示

## ビルド結果
exit code: 0（成功）

## PR
https://github.com/stillframe0224/stillframe-phase0/pull/43

## READMEへの追記
なし

## 動作確認
- `cd /Users/array0224/stillframe-phase0 && npm run build` を実行し成功
- Waitlistセクションで英語/日本語切替時に trust 文言が切り替わることを確認

## Market Pulse 関連性
- 参照: /Users/array0224/stillframe-phase0/reports/market_pulse/2026-02-17.md
- Top score 46 の「Ask HN: Which password manager do you use...」で `help / recommend / today` の信頼・選定不安が示唆されていたため、登録導線での安心感補強を実施
