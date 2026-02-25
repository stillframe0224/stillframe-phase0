# 2026-02-25 FANZA Thumbnail Uniqueness Fix

## Symptoms
- FANZA/DMM cards were saved with the same thumbnail image across different products.

## Root cause
- Server-side link preview could fetch an age-gate/common page, then accept that page's shared `og:image`.
- Shared image reuse made different product URLs resolve to the same thumbnail.

## Fix
- Added FANZA/DMM fallback module: `app/api/link-preview/fanzaThumb.mjs`
  - `isAgeGateHtml(html, finalUrl)`: detects age-gate/common HTML markers.
  - `extractCid(url)`: extracts `cid` from `?cid=...` and `/cid=.../` patterns.
  - `inferDmmCoverCandidates(cid)`: generates small ordered cover candidates.
  - `headOk(url)`: lightweight probe via `GET` + `Range: bytes=0-0` (200/206 accepted).
  - `chooseCoverByProbe(cid, probe)`: picks first valid candidate.
- Updated `app/api/link-preview/route.ts`
  - For DMM/FANZA on upstream non-2xx: attempt CID-based cover inference before Jina fallback.
  - For DMM/FANZA on 2xx HTML:
    - if age-gate detected or shared-meta-image suspected, do not trust page `og:image`.
    - infer cover from CID candidates and adopt first probe-success URL.
    - if no CID/probe success, return `image: null` instead of a wrong shared image.

## Tests
Commands:

```bash
npm run test:unit
node --test scripts/tests/shinen_fanza_thumb_unique.test.mjs
npm run build
bash scripts/tests/test_codex_headings.sh
bash scripts/tests/test_design_tokens.sh
```

Result:
- All commands passed.
- Added network-independent regression test:
  - `scripts/tests/shinen_fanza_thumb_unique.test.mjs`
    - age-gate HTML detection
    - CID extraction
    - candidate generation
    - probe-ordered selection using DI/mock probe

## Risk & rollback
- Risk:
  - Extra probe requests (max small candidate set) on DMM/FANZA fallback path only.
  - CID missing/changed URL formats can still resolve `null` image.
- Rollback:
  1. Revert `app/api/link-preview/route.ts` DMM/FANZA inference branch.
  2. Remove `app/api/link-preview/fanzaThumb.mjs`.
  3. Remove `scripts/tests/shinen_fanza_thumb_unique.test.mjs`.
