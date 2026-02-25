# 2026-02-25 X/IG DOM Extraction SSOT

## Background
- X syndication API (`cdn.syndication.twimg.com`) can be unavailable or incomplete.
- IG/X login-wall and restricted pages can expose incorrect shared images when server-side meta parsing is used alone.
- Fix direction: make **save-time DOM extraction** the SSOT for visible media, keep server unfurl as best-effort only.

## Strategy
- Capture media from the page the user is actually viewing (bookmarklet / extension injection).
- For X:
  - photo: pick largest `pbs.twimg.com/media` image and upgrade to `name=orig`.
  - video: pick `video.poster` and upgrade to `name=orig`.
  - keep embed playback (`mk=embed`, `embedUrl`) and attach DOM poster.
- For Instagram:
  - photo: pick largest `img[srcset]` candidate.
  - fallback: largest natural-size image.
  - reel/tv: keep `mk=embed` and attach poster when available.
- For non-public/broken pages on X/IG:
  - treat missing image/poster as normal (`null`) and avoid generic OG/logo fallback.
- Server remains best-effort:
  - log `x_syndication_empty` and `ig_embed_broken`.

## Implementation
- `app/bookmarklet/page.tsx`
  - Added URL canonicalization (drops minimal tracking params).
  - Added X/IG DOM extract logic and payload fields (`img/poster/mk/embed/provider`).
  - Prevented generic meta fallback on X/IG when platform media is unavailable.
- `chrome-extension/popup/popup.js`
  - Added same X/IG DOM extraction flow in injected extractor.
  - Queue payload now carries `poster/mediaKind/embedUrl/provider` in addition to `img`.
  - Immediate open URL now includes `poster/mk/embed/provider`.
  - Prevented generic fallback on X/IG hosts.
- `chrome-extension/background.js`
  - Synced fallback path to include canonical URL and `poster/mk/embed/provider`.
  - Added X/IG DOM extraction overrides and no-fallback behavior on X/IG hosts.
- `app/app/shinen/lib/clip-receiver.ts`
  - Extended `ClipData` to include media fields.
- `app/app/shinen/ShinenCanvas.tsx`
  - Queue-driven clip creation now supports embed payload (`media.kind=embed`, `embedUrl`, `posterUrl`, `provider`) and image fallback.
- `app/api/link-preview/route.ts`
  - Added best-effort logs:
    - `x_syndication_empty`
    - `ig_embed_broken`
  - Kept existing null/fallback behavior.
- `app/app/shinen/lib/domMediaExtract.mjs`
  - Added pure extraction utilities used by tests.

## Tests (No Network Dependency)
- `npm run test:unit` -> PASS
- `node --test scripts/tests/shinen_x_ig_dom_extract.test.mjs` -> PASS
- `node --test scripts/tests/shinen_x_ig_media.test.mjs` -> PASS
- `npm run build` -> PASS
- `bash scripts/tests/test_codex_headings.sh` -> PASS
- `bash scripts/tests/test_design_tokens.sh` -> PASS

## Risks
- DOM extraction depends on host DOM structure, but this is still the most reliable source within user-visible permissions.
- X/IG DOM variations can still occur; mitigated by conservative fallback (no wrong logo images on restricted pages).

## Rollback
- Revert this PR commit to restore previous save flow behavior.
- Primary touched paths:
  - `app/bookmarklet/page.tsx`
  - `chrome-extension/popup/popup.js`
  - `chrome-extension/background.js`
  - `app/app/shinen/ShinenCanvas.tsx`
  - `app/app/shinen/lib/clip-receiver.ts`
  - `app/api/link-preview/route.ts`
