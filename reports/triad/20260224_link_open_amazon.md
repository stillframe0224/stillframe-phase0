# SHINEN triad report — 2026-02-24

## Symptoms
- 外部リンクが開けない/開きづらい:
  - `ThoughtCard` のリンク導線が hover 前提で、タッチ環境では到達不能になりやすかった。
  - メディア（image/pdf）は `window.open` 依存で、ジェスチャ/ブラウザ判定で不安定になる余地があった。
- Amazonサムネが出ない:
  - AmazonページHTMLで `landingImage` / `data-a-dynamic-image` を十分拾えず、画像候補が空または弱い候補になるケースがあった。
  - `image-proxy` は Instagram CDN 向けヘッダのみで、Amazon CDN 取得時に 403 になりやすい条件が未対応だった。

## Root cause
- リンク:
  - `app/app/shinen/ThoughtCard.tsx` の open 導線が `isHovered` 条件だったため、hover がない入力系（タッチ）で実質使えなかった。
  - 同ファイルで image/pdf の open が `<a>` ではなく `window.open` だった。
- Amazon画像:
  - `app/api/link-preview/route.ts` は抽出が分散し、Amazon特化の最大解像度選択（`data-a-dynamic-image`）が不十分だった。
  - `app/api/image-proxy/route.ts` に Amazon CDN 専用ヘッダ/Referer 制御がなく、取得失敗時の観測ログも不足していた。

## Fix
- `app/app/shinen/ThoughtCard.tsx`
  - カード右上の open 導線を常時表示（`↗ open`）に変更。
  - `target="_blank" rel="noopener noreferrer"` の `<a>` を使用し、`data-no-drag` + `stopPropagation` で gesture 競合回避。
  - image/pdf の open も `<a>` 化して `window.open` 依存を除去。
- `app/app/shinen/lib/proxy.ts`
  - `toProxySrc(src, referrerUrl?)` に拡張し、`/api/image-proxy` に `ref` クエリを渡せるようにした。
- `app/api/link-preview/imageExtract.ts` (新規)
  - 画像抽出を純関数化し、以下の優先順位で決定:
    1) `og:image`
    2) `twitter:image`
    3) `link[rel="image_src"]`
    4) 代表 `img`
    5) Amazon特化フォールバック（`#landingImage`, `#imgTagWrapperId img`, `data-a-dynamic-image` 最大解像度）
  - URL正規化（`&amp;`, `&quot;` 等のデコード、trim、相対→絶対）を実装。
- `app/api/link-preview/route.ts`
  - 画像決定を `pickBestImageFromHtml(...)` に集約。
- `app/api/image-proxy/amazonHeaders.ts` (新規)
  - Amazon CDN 判定と Amazon向けヘッダ生成を純関数化。
- `app/api/image-proxy/route.ts`
  - Amazon CDN 時のみ UA/Accept/Accept-Language/Referer を付与。
  - 失敗時に `host/status` を `console.warn` へ記録（機密情報なし）。

## Tests
- 追加テスト:
  - `scripts/tests/shinen_link_open_amazon.test.mjs`
    - `ThoughtCard.tsx` の open 導線定義が `<a target="_blank" rel="noopener noreferrer">` を保持すること
    - Amazon `landingImage(data-old-hires)` 抽出
    - Amazon `data-a-dynamic-image` の最大解像度選択
    - Amazon CDN ヘッダ生成/ホスト判定

- 実行コマンドと結果（ローカル）:
  - `npm run test:unit` → PASS
  - `npm run build` → PASS
  - `bash scripts/tests/test_codex_headings.sh` → PASS
  - `bash scripts/tests/test_design_tokens.sh` → PASS
  - `node --test scripts/tests/test_tunnel_arrange_nonoverlap.mjs scripts/tests/shinen_link_open_amazon.test.mjs` → PASS (legacy test skip expected)

## Risk & rollback
- リスク:
  - open導線の常時表示によりカード上部UI密度がわずかに増える。
  - Amazon以外CDNへのヘッダ挙動は変更していないため、非Amazonの取得失敗率に影響は限定的。
- ロールバック手順:
  1. `git revert <this-fix-commit-sha>`
  2. `npm run build && npm run test:unit` で復帰確認

## Notes
- ネットワーク依存テストは追加せず、HTML断片と純関数テストで再現/担保した。
- 既存 UX を維持しつつ、追加UIは最小限（`↗ open`）に留めた。
