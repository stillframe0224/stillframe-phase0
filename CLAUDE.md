# CLAUDE.md — stillframe-phase0

## Project
SHINEN — a thought-capture app where every card gets an image.
Next.js 16 (Turbopack) + Supabase + Tailwind CSS. Deployed on Vercel.

## Stack
- **Framework**: Next.js 16 App Router (`app/` directory)
- **Auth**: Supabase Auth (Google OAuth)
- **DB**: Supabase (PostgreSQL, `cards` table)
- **Storage**: Supabase Storage (`card-images` bucket)
- **Styling**: Tailwind CSS v4 + inline styles
- **Deploy**: Vercel (auto-deploy on push to `main`)

## Key paths
- `app/page.tsx` — Landing page (LP)
- `app/app/page.tsx` — Main app (Quick Capture + card grid)
- `app/auth/login/page.tsx` — Login page
- `app/auth/callback/route.ts` — OAuth callback
- `app/api/og-image/route.ts` — OGP image extraction API
- `lib/supabase/client.ts` — Browser Supabase client
- `lib/supabase/server.ts` — Server Supabase client
- `lib/cardTypes.ts` — Card type definitions (memo, idea, quote, etc.)

## Environment variables (NEXT_PUBLIC_* are inlined at build time)
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon key
- `NEXT_PUBLIC_GUMROAD_PRODUCT_URL` — Gumroad purchase link
- `NEXT_PUBLIC_WAITLIST_POST_URL` — Waitlist endpoint (optional)
- `NEXT_PUBLIC_WAITLIST_FALLBACK_EMAIL` — Fallback mailto

## Workflow: modify → build → push → verify → fix loop
1. **Modify** — Edit source files
2. **Build** — `npm run build` (must pass with zero errors)
3. **Push** — `git add <files> && git commit && git push origin main`
   - Remote is SSH: `git@github.com:array0224-cloud/stillframe-phase0.git`
   - Push should complete without interactive auth prompts
4. **Wait for deploy** — `sleep 70` then check:
   - `gh api repos/array0224-cloud/stillframe-phase0/commits/<sha>/status`
5. **Verify** — `WebFetch` the deployed URL to confirm behavior
6. **If error** — Diagnose, fix, and restart from step 1

## Git conventions
- Remote: SSH (`git@github.com:array0224-cloud/stillframe-phase0.git`)
- Author: `array0224-cloud <array0224-cloud@users.noreply.github.com>`
- Commit style: `type: short description` (feat/fix/chore/refactor)
- Always include `Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>`

## Important notes
- Next.js 16 deprecated `middleware.ts` — do NOT use it (causes 404 on Vercel)
- `NEXT_PUBLIC_*` env vars are inlined at BUILD TIME — Vercel must rebuild after env var changes
- Auth is handled client-side in `app/app/page.tsx` (redirect to `/auth/login` if no user)
- The `/app` page is pre-rendered as static (`○`) — useEffect handles runtime logic
