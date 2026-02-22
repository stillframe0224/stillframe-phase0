# Task: Waitlist送信失敗時にメール代替CTAを表示し、登録導線を維持する
**ID**: 20260222-230123-waitlist-fallback-cta
**Date**: 2026-02-22 23:07 JST
**Est**: 25min / **Actual**: 24min
**Session**: nightly

## 変更ファイル
- /Users/array0224/stillframe-phase0/app/components/Waitlist.tsx: webhook失敗時にmail fallback CTAを表示、mailto生成を関数化、fallbackクリック計測追加
- /Users/array0224/stillframe-phase0/lib/copy.ts: fallback CTA/hint の文言（ja/en）追加

## ビルド結果
exit code: 0（成功）

## PR
https://github.com/stillframe0224/stillframe-phase0/pull/146

## READMEへの追記
なし

## 動作確認
- WaitlistでPOST失敗時にエラーメッセージが表示されること
- fallbackEmail と postUrl がある時のみ「メールで登録する / Email us instead」が表示されること
- CTAクリックで mailto が開き、件名・本文が入ること

## Market Pulse 関連性
reports/market_pulse/2026-02-17.md の Pain高スコア群（manual/issue/problem）を踏まえ、フォーム失敗時の手動代替導線をUXに反映
