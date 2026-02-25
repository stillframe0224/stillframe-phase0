# 2026-02-25 IG/X HQ Media + MEMO Left

## Symptoms
- Instagram thumbnail/poster resolution was often low.
- X status media (photo/video poster) was missing or unreliable under login-wall-heavy HTML paths.
- MEMO chip was positioned at bottom-right; requested position is bottom-left.

## Root Cause
- Instagram flow relied mainly on generic HTML/meta extraction, which often selected lower-resolution URLs instead of largest `srcset` candidates from embed pages.
- X flow depended on HTML parsing and could miss media details when status pages were constrained by login walls.
- MEMO chip layout order and margin rules placed it on the right side in the footer row.

## Fix
- `app/api/link-preview/xigMedia.mjs`
  - Added `extractTweetId`, `makeInstagramEmbedUrl`, `parseLargestSrcsetImage`, and `parseSyndicationTweetMedia`.
  - Added X media URL normalization toward larger variants (`name=large`, `:large`) where safe.
- `app/api/link-preview/route.ts`
  - Instagram: fetches embed HTML and prefers largest `srcset` candidate for poster/image.
  - X: for `/status/<id>` URLs, fetches syndication JSON (`tweet-result`) and extracts photo/video poster media.
  - Keeps existing fallback behavior when syndication/embed extraction is unavailable.
- `app/api/image-proxy/route.ts`
  - For Instagram CDN hosts, response cache-control now includes `no-transform` to avoid intermediary degradation.
- `app/app/shinen/ThoughtCard.tsx`
  - Reordered footer chips so MEMO renders on the left side; behavior unchanged.

## Tests
- `npm run test:unit` -> PASS
- `node --test scripts/tests/shinen_x_ig_media.test.mjs` -> PASS
- `node --test scripts/tests/shinen_thumb_render_modes.test.mjs` -> PASS
- `node --test scripts/tests/shinen_link_open_amazon.test.mjs` -> PASS
- `npm run build` -> PASS
- `bash scripts/tests/test_codex_headings.sh` -> PASS
- `bash scripts/tests/test_design_tokens.sh` -> PASS

## Risk / Rollback
- Risk: syndication JSON structure may vary; mitigation is existing fallback path remains active.
- Risk: embed `srcset` shapes may vary; parser falls back to `og:image` / `twitter:image`.
- Rollback: revert commit touching the four implementation files and the added tests in `scripts/tests/shinen_x_ig_media.test.mjs`.
