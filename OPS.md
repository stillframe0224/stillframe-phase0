# OPS.md — SHINEN Lite Runbook

## 1. System overview

SHINEN Lite is a thought-capture app built on Next.js 16 (App Router, Turbopack) with Supabase (PostgreSQL + Auth + Storage) deployed to Vercel. Users authenticate via Google OAuth, create cards with text and images, and each card can auto-fetch link previews. The production URL is `https://stillframe-phase0.vercel.app`. Auto-deploy triggers on every push to `main`.

## 2. Critical invariants

- **Supabase anon key length >= 180**: The `NEXT_PUBLIC_SUPABASE_ANON_KEY` must be a valid JWT. The OAuth smoke test checks `key_length >= 200` via `/api/debug-auth`. If this fails, the key is missing or truncated in Vercel env vars.
- **`cards.client_request_id` UNIQUE constraint**: Prevents duplicate card inserts. The column is nullable; the app falls back gracefully if the column is missing, but idempotency is lost.
- **`/api/link-preview` SSRF protections**: Port allowlist (empty/80/443), hostname blocklist (localhost, 0.0.0.0, ::1), private IP ranges blocked (127/8, 10/8, 172.16/12, 192.168/16, 169.254/16, 100.64/10, fc00::/7, fe80::/10), DNS resolution check, and per-hop redirect validation. Violations return `400 {"error":"blocked_url"}`.
- **Row-Level Security (RLS)** is enabled on `cards` — users can only read/write their own rows.

## 3. Quick smoke commands

Run locally against production (Node 20, no deps):

```bash
# OAuth flow: key presence, Google redirect, callback behavior
node scripts/oauth_smoke.mjs

# Link preview: SSRF blocks, YouTube shortcut, external fetch
node scripts/link_preview_smoke.mjs
```

Both scripts exit non-zero on any failure.

## 4. Common failures & fixes

### Invalid or missing Supabase API key

**Symptom**: OAuth smoke fails on `key_length`, or `/app` shows "Supabase not configured".

**Fix**: Go to Vercel Dashboard > Project > Settings > Environment Variables. Ensure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set for all environments (Production, Preview, Development). These are inlined at build time, so **redeploy** after changing them.

### `client_request_id` column missing

**Symptom**: Card saving works but duplicates may appear (idempotency lost). The app handles this gracefully by retrying without the column, but you lose the UNIQUE guard.

**Fix**: Run in Supabase SQL Editor:

```sql
ALTER TABLE cards ADD COLUMN IF NOT EXISTS client_request_id text;
ALTER TABLE cards ADD CONSTRAINT cards_client_request_id_key UNIQUE (client_request_id);
```

### Link previews not loading

**Symptom**: Cards with URLs show SVG fallback instead of og:image preview.

**Debug**:
1. Visit `/app?debug=1` — each card shows `preview: saved|youtube|api|svg|none` label
2. Open browser console — one-line logs: `[preview] fetch { url, status, ms }` and `[preview] img_error { type, url }`
3. For persistent debug: `localStorage.setItem("SHINEN_DEBUG_PREVIEW", "1")` then reload
4. To disable: `localStorage.removeItem("SHINEN_DEBUG_PREVIEW")`

**Common causes**:
- og:image CDN rejecting requests → fixed by `referrerPolicy="no-referrer"` on `<img>` (already applied)
- Target site has no og:image/twitter:image meta tags → falls back to SVG (expected)
- SSRF protection blocking a legitimate URL → check server logs with `?debug=1` passed to the API

### OAuth redirect loop or 404

**Symptom**: Login redirects fail or `/auth/callback` returns 404.

**Fix**: Do NOT use `middleware.ts` (deprecated in Next.js 16, causes 404 on Vercel). Auth redirects are handled client-side in `app/app/page.tsx`. Verify Supabase Authentication > URL Configuration has the correct redirect URLs:
- `https://stillframe-phase0.vercel.app/auth/callback`
- `http://localhost:3000/auth/callback`

## 5. Deployment checklist

1. **Build locally**: `npm run build` — must pass with zero errors
2. **Push**: `git push origin main` — auto-deploy triggers
3. **Wait ~70s** for Vercel build + deploy
4. **Check deploy status**: `gh api repos/array0224-cloud/stillframe-phase0/commits/<sha>/status`
5. **Verify**:
   - `/` — LP loads with nav, hero, cards
   - `/app` — redirects to login (or shows card grid if authed)
   - `/api/link-preview?url=http://127.0.0.1` — returns `400 blocked_url`
6. **Run smoke tests**: `node scripts/oauth_smoke.mjs && node scripts/link_preview_smoke.mjs`

After changing `NEXT_PUBLIC_*` env vars in Vercel, you must trigger a **manual redeploy** (Deployments tab > Redeploy) because these values are inlined at build time.

## 6. CI

**Workflow**: `.github/workflows/oauth_smoke.yml`

**Triggers**:
- Push to `main`
- Daily cron at 18:30 UTC (03:30 JST)
- Manual dispatch (Actions tab > "oauth-smoke" > Run workflow)

**Checks run**:
| Step | Script | What it checks |
|------|--------|----------------|
| OAuth smoke | `scripts/oauth_smoke.mjs` | Anon key length, Google OAuth redirect, callback behavior |
| Link preview smoke | `scripts/link_preview_smoke.mjs` | SSRF blocks (127.0.0.1, 169.254.169.254), YouTube shortcut, external fetch (github.com) |

**On failure**: Step Summary shows last 200 lines of output. A GitHub issue is created (or commented on) with the `oauth-smoke` label.

## Related docs

- [OPS/supabase-setup.md](OPS/supabase-setup.md) — Full Supabase setup: table DDL, RLS policies, Google OAuth config, Storage bucket, env vars
- [OPS/deploy.md](OPS/deploy.md) — Vercel deploy guide: initial setup, env vars, verification steps
- [CLAUDE.md](CLAUDE.md) — Project conventions for AI-assisted development
