# Triad Report: Pricing CTA Urgency Copy

**ID**: 20260219-080800-pricing-cta-urgency-copy
**Date**: 2026-02-28
**Status**: Complete

## Summary
Pricingカードに限定オファー文言を追加し、Gumroad導線を強化した。

## Changes

### `lib/copy.ts`
- `badge` 追加: "Launch Offer" / "ローンチ特別価格" — カード上部の注目バッジ
- `urgency` 更新: "残りわずか" のスカーシティ表現を追加
- `guarantee` 追加: "いつでも解約可。7日間返金保証。" — CTA下の安心材料

### `app/components/Pricing.tsx`
- カード上部に赤色バッジ (`#c04000`) を追加
- CTA下に返金保証テキストを追加

## Build
- `npm run build` — pass (zero errors)

## Risk
- Low: コピーのみの変更。ロジック・状態管理への影響なし
