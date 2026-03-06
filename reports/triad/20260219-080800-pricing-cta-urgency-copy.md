# Triad Report: Pricing CTA Urgency Copy

**ID**: 20260219-080800-pricing-cta-urgency-copy
**Date**: 2026-03-06
**Status**: Complete

## Summary
Pricingカードの限定オファー文言を強化し、Gumroad購入導線のコンバージョンを改善。
取り消し線の通常価格表示と創業メンバー特典メッセージを追加。

## Changes

### `lib/copy.ts`
- `regularPrice` 追加: "$19" — 取り消し線で表示する通常価格
- `founderNote` 追加: "創業メンバーは値上げ後もこの価格を永久適用" — CTA下の特典訴求

### `app/components/Pricing.tsx`
- 価格表示の左側に `$19` の取り消し線テキストを追加（アンカリング効果）
- CTA下・返金保証の上に創業メンバー特典メッセージ（`#c04000` アクセントカラー）を追加

## Build
- `npm run build` — pass (zero errors)

## Risk
- Low: コピー・スタイルのみの変更。ロジック・状態管理への影響なし
