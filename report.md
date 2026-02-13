# Diagnostic & Fix Report — NEXT_PUBLIC_SUPABASE_ANON_KEY

Date: 2026-02-13

---

## Problem

Production `/app` page showed `URL: set / KEY: MISSING` error, blocking all functionality.

---

## Root Cause

**`NEXT_PUBLIC_SUPABASE_ANON_KEY` exists in Vercel but has an EMPTY value.**

### Evidence

1. Deployed a diagnostic API endpoint (`/api/debug-env`) to read `process.env` on Vercel's server at runtime.
2. Results confirmed:
   | Env Var | Status |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Set (40 chars, correct) |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **Empty** |
   | `NEXT_PUBLIC_WAITLIST_FALLBACK_EMAIL` | Set (19 chars) |
   | `SUPABASE_SERVICE_ROLE_KEY` | Empty |

3. Inspected the production JS bundle — confirmed `isSupabaseConfigured()` compiled to `return false` and `getConfigStatus()` compiled to `{url:!!tR, key:false}`.

### Why `NEXT_PUBLIC_SUPABASE_URL` works but `NEXT_PUBLIC_SUPABASE_ANON_KEY` doesn't

Both are `NEXT_PUBLIC_*` vars inlined at build time. The URL has a valid value in Vercel; the anon key's value is empty. The env var entry was likely created without pasting the actual key.

---

## Code Changes Made

### 1. `app/app/layout.tsx` (NEW)

- Added `export const dynamic = "force-dynamic"` — makes `/app` server-rendered on each request
- Injects `window.__SUPABASE_CONFIG__` via `<script>` tag with runtime `process.env` values
- This means env vars are read at request time, NOT at build time

### 2. `app/auth/layout.tsx` (NEW)

- Same pattern as above for `/auth/*` routes
- Login page is now also dynamic, with runtime env injection

### 3. `lib/supabase/client.ts` (MODIFIED)

- Added `window.__SUPABASE_CONFIG__` fallback
- If build-time `process.env.NEXT_PUBLIC_*` is empty, falls back to runtime-injected values
- Declared `Window.__SUPABASE_CONFIG__` type globally
- `isSupabaseConfigured()` and `getConfigStatus()` now use the same runtime-aware logic

### Build output change

| Route | Before | After |
|---|---|---|
| `/app` | Static | Dynamic |
| `/auth/login` | Static | Dynamic |
| `/` (LP) | Static | Static (unchanged) |

---

## Remaining Action Required

> **Set the actual Supabase anon key value in Vercel.**

The code fix is in place and working. Once the env var has a real value, the runtime injection will pass it through and the app will work.

### How to fix (choose one):

**Option A — Vercel Dashboard (easiest):**
1. Go to https://vercel.com -> project `stillframe-phase0` -> Settings -> Environment Variables
2. Find `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Paste the actual anon key (get it from Supabase dashboard: Project Settings -> API -> anon/public key)
4. Save — the app will work immediately (no redeploy needed, since pages are now dynamic)

**Option B — Vercel CLI:**
```bash
vercel login
vercel link --yes
vercel env rm NEXT_PUBLIC_SUPABASE_ANON_KEY production preview development --yes
echo "YOUR_ACTUAL_ANON_KEY" | vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production preview development
```

**Option C — Also set SUPABASE_SERVICE_ROLE_KEY** (recommended for server-side operations):
```bash
vercel env add SUPABASE_SERVICE_ROLE_KEY production preview development
```

---

## Verification Results

### Page Status (after code fix deployment)

| URL | HTTP | Content |
|---|---|---|
| `https://stillframe-phase0.vercel.app/` | 200 | LP loads correctly — hero, demo, pricing, newsletter sections all present |
| `https://stillframe-phase0.vercel.app/auth/login` | 200 | Login page renders — Google + email sign-in buttons visible. Shows config warning (expected until env var is set) |
| `https://stillframe-phase0.vercel.app/app` | 200 | Page renders without "KEY: MISSING" in initial HTML. Runtime config injection active. Will fully work once env var has a value |

### Runtime Injection Verified

Both `/app` and `/auth/login` contain the injected script:
```html
<script>window.__SUPABASE_CONFIG__={"url":"https://zrfvqbygfkreuaivzvar.supabase.co","key":""}</script>
```

The `url` field is correctly populated. The `key` field will populate automatically once the Vercel env var has a real value — no rebuild or code changes needed.

---

## Commits

| SHA | Message |
|---|---|
| `395bd5b` | fix: inject Supabase config at runtime via dynamic layout |
| `0a00522` | chore: add temporary debug-env endpoint to diagnose Vercel env vars |
| `e044c42` | chore: expand debug-env to check all NEXT_PUBLIC env vars |
| `8ca6f75` | fix: add runtime env injection for auth routes, remove debug endpoint |

---

## Summary

- **Root cause**: `NEXT_PUBLIC_SUPABASE_ANON_KEY` has an empty value in Vercel (the key name exists but the value is blank)
- **Code fix**: Added runtime env injection via dynamic layouts — eliminates dependency on build-time inlining
- **Remaining**: Paste the actual Supabase anon key value into the Vercel env var
- **No rebuild needed**: Once the value is set, the dynamic pages will pick it up on the next request
- **Vercel CLI auth**: Could not complete — requires browser-based OAuth approval. All 3 auth URLs were opened in the browser but no approval was completed
