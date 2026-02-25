# 2026-02-25 Thumb SmartFit + Instagram HQ

## Symptoms
- Amazon / FANZA(DMM) の商品サムネが `cover` 固定で上下左右が見切れる。
- Instagram のサムネURLが `p640x640` や `s320x320` など低解像度のまま保存され、カード上で粗く見える。

## Root cause
- カードの画像描画がドメイン非依存で `object-fit: cover` 固定だったため、商品画像の全体表示要件に合わなかった。
- 保存時/抽出時に Instagram の解像度トークン昇格ロジックがなく、低解像度URLがそのまま残っていた。
- bookmarklet 側も Instagram 専用の「最大 currentSrc 選択」優先がなく、meta優先で低解像度候補を拾うことがあった。

## Fix
- SmartFit 追加:
  - `app/app/shinen/lib/thumbRender.mjs` を追加し、`amazon.*` / `amzn.*` / `a.co` / `*.dmm.co.jp` を `contain_blur` 判定。
  - `app/app/shinen/ThoughtCard.tsx` の画像描画で `contain_blur` 時は
    - 背景: 同画像 `cover + blur(14px)`
    - 前景: 同画像 `contain`
    - wrapper は `padding:0`, `background:transparent`, `border:none`, `overflow:hidden`
    として白枠なし・見切れなしに変更。
- Instagram HQ 化:
  - `app/api/link-preview/instagramImage.mjs` を追加し、
    - `upgradeInstagramUrl(url)` で `p640x640/s320x320` などを `1080x1080` に昇格。
    - `pickLargestInstagramImageCandidate(images)` で `currentSrc` ベース最大面積を選択（icon/small除外）。
  - `app/api/link-preview/imageExtract.mjs` の URL 正規化最終段で `upgradeInstagramUrl` を適用。
  - `app/api/image-proxy/route.ts` でも入力URLを `upgradeInstagramUrl` 経由にして防御的に昇格。
  - `app/bookmarklet/page.tsx` で Instagram の場合は `document.images` から最大 `currentSrc` を優先する抽出を追加。

## Tests
実行コマンド:

```bash
npm run test:unit
node --test scripts/tests/shinen_link_open_amazon.test.mjs
node --test scripts/tests/shinen_thumb_render_modes.test.mjs
npm run build
bash scripts/tests/test_codex_headings.sh
bash scripts/tests/test_design_tokens.sh
```

結果:
- すべて PASS（失敗 0）。
- 追加回帰テスト:
  - `scripts/tests/shinen_thumb_render_modes.test.mjs`
    - amazon/fanza/dmm で `contain_blur` 判定
    - Instagram URL の低解像度トークン昇格
    - Instagram の最大 `currentSrc` 選択（icon除外）
  - `scripts/tests/shinen_link_open_amazon.test.mjs` に SmartFit/IG抽出文字列の検証を追加。

## Risk & rollback
- リスク:
  - `contain_blur` は通常 `cover` より描画コストが上がる（ただし対象ドメイン限定）。
  - Instagram URL 形式の将来変更で昇格パターンが外れる可能性。
- ロールバック:
  1. `app/app/shinen/ThoughtCard.tsx` の `contain_blur` 分岐を削除し、従来 `cover` 描画へ戻す。
  2. `app/app/shinen/lib/thumbRender.mjs` を削除。
  3. `app/api/link-preview/instagramImage.mjs` の適用箇所（`imageExtract.mjs`, `image-proxy/route.ts`, `bookmarklet/page.tsx`）を差し戻す。
