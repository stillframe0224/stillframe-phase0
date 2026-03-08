# Triad Report: Pricing CTA Urgency Copy

**ID**: 20260219-080800-pricing-cta-urgency-copy
**Date**: 2026-03-08
**Status**: Complete

## Summary
Pricingカードに「先着50名限定」バナーを追加し、Gumroad購入導線のスカーシティを強化。

## Changes

### `lib/copy.ts`
- `limitedBanner` 追加: "First 50 founding members only" / "創業メンバー先着50名限定"
- 具体的な人数制限により、曖昧な「残りわずか」より強いスカーシティを実現

### `app/components/Pricing.tsx`
- urgency pill と CTA ボタンの間に限定バナーを追加
- `#c04000` テキスト、uppercase、letter-spacing で視覚的に目立たせる

## Build
- `npm run build` — pass (zero errors)

## Risk
- Low: コピー・スタイルのみの変更。ロジック・状態管理への影響なし
