# Triad Report: Pricing CTA Urgency Copy

**ID**: 20260219-080800-pricing-cta-urgency-copy
**Date**: 2026-03-09
**Status**: Complete

## Summary
Pricingカードに限定オファー文言を追加し、Gumroad購入導線を強化。具体的な節約額・締切・リスクフリー表記で購買意欲を高める。

## Changes

### `lib/copy.ts`
- `savings` 追加: "You save $108/year vs regular price" — 割引の具体額を明示
- `deadline` 追加: "Launch pricing ends when 50 spots fill" — 枠制限による締切感
- `riskFree` 追加: "Try risk-free for 7 days" — CTA直下でリスク軽減

### `app/components/Pricing.tsx`
- 価格ブロック直下に年間節約額（`savings`）を緑文字で追加
- 限定バナー下に枠制限デッドライン（`deadline`）を追加
- CTA下に「リスクフリー」テキスト（`riskFree`）を緑文字で追加
- urgency → limitedBanner → deadline の3段構成で段階的にスカーシティを強化

## Build
- `npm run build` — pass (zero errors)

## Risk
- Low: コピー・スタイルのみの変更。ロジック・状態管理への影響なし
