# Triad Report: Pricing CTA Urgency Copy

**ID**: 20260219-080800-pricing-cta-urgency-copy
**Date**: 2026-03-07
**Status**: Complete

## Summary
Pricingカードの限定オファー文言をさらに強化し、Gumroad購入導線のコンバージョンを改善。
割引率バッジ、CTA直下のサブテキスト、よりスカーシティの高い文言に更新。

## Changes

### `lib/copy.ts`
- `discount` 追加: "47% OFF" — 価格横に表示する割引率バッジ
- `ctaSub` 追加: "$10/月を確保 — ローンチ後に値上げ予定" — CTA直下の補足テキスト
- `urgency` 更新: "この価格の創業メンバー枠は残りわずか" — よりスカーシティの高い表現に変更
- `founderNote` 微修正: "forever" を追加して永久保証を強調

### `app/components/Pricing.tsx`
- 価格表示の右側に緑色 `47% OFF` バッジを追加（`#2D8F50` 背景）
- CTA ボタン直下に薄いグレーのサブテキストを追加（値上げ予告）
- 既存の urgency / founderNote はそのまま維持

## Build
- `npm run build` — pass (zero errors)

## Risk
- Low: コピー・スタイルのみの変更。ロジック・状態管理への影響なし
