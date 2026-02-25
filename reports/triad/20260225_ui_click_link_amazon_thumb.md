# 2026-02-25 UI click-link + Amazon thumbnail recovery

## What changed
- Removed the top-right `open` UI completely:
  - deleted `↗ open` overlay anchor from `ThoughtCard`.
  - no visible open label/button/placeholder remains.
- Unified image click behavior:
  - image thumbnails are now wrapped by a single link (`data-open-link="1"`).
  - image click always opens link navigation (`target="_blank" rel="noopener noreferrer"`).
  - removed image `zoom-in` affordance and image-open-by-thumbnail behavior.
- Removed white frame around thumbnails:
  - image link wrapper now has no padding/background/border and uses transparent styles.
  - thumbnail image styles remove background/border/margins and stay edge-to-edge in the card media slot.
- Restored Amazon thumbnail reliability:
  - save-time capture route now extracts from DOM snapshot via `pickBestImageFromHtml` (Amazon selectors included).
  - server `/api/link-preview` Amazon fetch headers strengthened (UA/Accept-Language/Referer + sec-fetch style headers).
  - Amazon-specific extraction priority improved before generic representative fallback in parser logic.

## Root cause summary
- Open-link UI had diverged from desired interaction model and introduced a separate visible affordance.
- Image area behavior was split (`zoom-like` behavior vs link navigation) and could conflict with gesture handlers.
- Amazon extraction reliability depended on weak or blocked metadata paths without consistent save-time/server fallback.

## Files
- `app/app/shinen/ThoughtCard.tsx`
- `app/capture/page.tsx`
- `app/api/link-preview/route.ts`
- `app/api/link-preview/imageExtract.mjs`
- `scripts/tests/shinen_link_open_amazon.test.mjs`

## Tests and evidence
- `npm run test:unit` -> PASS
- `node --test scripts/tests/shinen_link_open_amazon.test.mjs` -> PASS
- `npm run build` -> PASS
- `bash scripts/tests/test_codex_headings.sh` -> PASS
- `bash scripts/tests/test_design_tokens.sh` -> PASS

## Risks
- Image area is now navigation-first: drag-start from the image region is intentionally suppressed in favor of link open.
- Amazon extraction still depends on source DOM shape; major upstream DOM changes could require selector updates.

## Rollback
1. Revert these files:
   - `app/app/shinen/ThoughtCard.tsx`
   - `app/capture/page.tsx`
   - `app/api/link-preview/route.ts`
   - `app/api/link-preview/imageExtract.mjs`
   - `scripts/tests/shinen_link_open_amazon.test.mjs`
2. Re-run:
   - `npm run test:unit`
   - `node --test scripts/tests/shinen_link_open_amazon.test.mjs`
   - `npm run build`
