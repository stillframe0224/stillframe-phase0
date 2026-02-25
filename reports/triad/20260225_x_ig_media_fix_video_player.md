# 2026-02-25 X/Instagram media fix + in-app video playback

## 症状
- X / Instagram で取得画像がロゴ・アイコン・ログイン壁由来になり、投稿画像と不一致。
- X / Instagram の動画系URLが画像扱いになり、カード内再生できない。

## 根因
- メタ抽出が `og:image` / `twitter:image` を無条件採用し、login wall HTMLや共通ロゴを弾いていなかった。
- X/IG の動画判定・埋め込みURLモデルがなく、`media.type=image` 前提の保存/描画だった。

## Fix
- `app/api/link-preview/xigMedia.mjs` を追加:
  - `isLoginWallHtml(url, html)` で X/IG のログイン壁文言検知
  - `collectImageCandidatesFromHtml` + `scoreImage` + `selectBestImageCandidate` で候補スコアリング
    - `pbs.twimg.com/media`, `cdninstagram/scontent` を優先
    - `favicon/logo/icon/avatar/sprite/svg/small` を減点
  - `detectVideoFromHtml` と `buildEmbedMedia` で X status / IG p|reel|tv の embed URL 生成
- `app/api/link-preview/route.ts`:
  - X/IGショートカット経路で上記ロジックを適用
  - video判定時は `mediaKind=embed`, `embedUrl`, `posterUrl`, `provider` を返却
  - login wall時は誤画像を採用せず、可能ならembedのみ返却（poster null許容）
- `app/app/shinen/hooks/useOgThumbnails.ts`:
  - `/api/link-preview` レスポンスの `mediaKind/embedUrl/posterUrl/provider` を保存・適用
  - `media.type="embed"` を既存カード互換を崩さず追加
- `app/app/shinen/ThoughtCard.tsx`:
  - `media.kind==="embed"` を YouTube同型で `thumb -> play -> iframe` 再生
  - 非動画画像のクリック外部遷移は既存維持
- `app/app/shinen/ShinenCanvas.tsx` + `app/bookmarklet/page.tsx`:
  - bookmarklet経由で `mk/embed/provider/poster` を受け渡し・保存

## Tests
実行コマンド:

```bash
npm run test:unit
node --test scripts/tests/shinen_x_ig_media.test.mjs
node --test scripts/tests/shinen_thumb_render_modes.test.mjs
node --test scripts/tests/shinen_link_open_amazon.test.mjs
npm run build
bash scripts/tests/test_codex_headings.sh
bash scripts/tests/test_design_tokens.sh
```

結果:
- 全PASS
- 新規 `scripts/tests/shinen_x_ig_media.test.mjs` を追加:
  - X photoで `pbs.twimg.com/media` 優先
  - X login wallで誤画像を弾きつつ embed URL 生成
  - IG photoで `scontent/cdninstagram` 優先
  - IG reel `og:video` を embed 扱い

## リスク / ロールバック
- リスク:
  - login wall 文言の変化で判定精度が落ちる可能性
  - embed iframe の provider 側仕様変更
- ロールバック:
  1. `app/api/link-preview/xigMedia.mjs` と route 内呼び出しを戻す
  2. `useOgThumbnails` の embed分岐を撤去
  3. `ThoughtCard` の embed再生分岐を撤去して従来表示へ戻す
