# SHINEN Phase0

## LP CTA A/B test

- デフォルトCTA: `/`
- 早期アクセス訴求CTA: `/?cta=early`

`cta=early` を付けると、ヒーローCTA文言が「早期アクセス料金を見る」に切り替わります。
計測イベント `lp_cta_variant_seen` と `hero_cta_click` に `variant` が付与されます。
