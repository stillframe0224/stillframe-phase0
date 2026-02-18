# 20260219_ig_image_proxy_ref_remove

## Changes
- Removed `ref` query handling from `app/api/image-proxy/route.ts`.
- `image-proxy` now sets `Referer` only when target host is Instagram CDN (`*.cdninstagram.com` / `*.fbcdn.net`).
- Added fixed browser UA and IG-specific `Accept` / `Accept-Language` only for IG CDN hosts.
- Non-IG hosts no longer receive any `Referer` forwarded from callers.
- Removed `&ref=` from `app/app/AppCard.tsx` proxy URL construction.

## Codex CHANGES resolution (v2)
Resolved both CHANGES flagged in `20260219_ig_image_proxy_ref_remove_codex.md`:

1. **https-only enforcement**: Added `parsed.protocol !== "https:"` check at entry point (line 81). Also added redirect downgrade protection: `next.protocol !== "https:"` check in redirect loop (line 52). Rejects `http:`, `data:`, `file:`, `javascript:` etc.

2. **IG-only headers**: UA/Accept/Accept-Language now sent ONLY when `isInstagramCdnHost(hop.hostname) === true`. Non-IG hosts receive empty headers object `{}` (lines 32-39). Previously all hosts received `User-Agent` and `Accept`.

## Validation
- `npm run build`: PASS (both pre- and post-Codex-resolution)
- `node scripts/link_preview_smoke.mjs`: FAIL in this environment (all cases `fetch failed`, external network unreachable)

## Notes
- SSRF guard path (`validateUrl` + `dnsCheck`) unchanged.
- Content-Type `image/*` check already existed (line 96) — no change needed.
- Timeout (AbortController, 6s) already existed — no change needed.
- Redirect re-validation per hop already existed — enhanced with https downgrade protection.
