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

### `pinned` column missing (optional feature)

**Symptom**: Card pinning feature is hidden/disabled. The app works normally without this column.

**To enable pinning**: Run in Supabase SQL Editor:

```sql
ALTER TABLE cards ADD COLUMN IF NOT EXISTS pinned boolean DEFAULT false;
CREATE INDEX IF NOT EXISTS cards_pinned_created_at_idx ON cards (pinned, created_at);
```

**Verify**:

```sql
SELECT pinned, COUNT(*) FROM cards GROUP BY pinned;
```

Pinned cards will appear at the top of the list regardless of date sort order.

### Metadata columns missing (optional for rich cards)

**Symptom**: Bookmarklet doesn't preserve preview images, uploaded media not supported.

**To enable metadata-driven cards**: Run in Supabase SQL Editor:

```sql
ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS source_url text;
ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS site_name text;
ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS preview_image_url text;
ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS media_kind text;
ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS media_path text;
ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS media_thumb_path text;
ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS media_mime text;
ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS media_size bigint;
ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS sort_key text;
ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS file_id uuid;
ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
CREATE INDEX IF NOT EXISTS cards_source_url_idx ON public.cards (source_url);
CREATE INDEX IF NOT EXISTS cards_site_name_idx ON public.cards (site_name);
CREATE INDEX IF NOT EXISTS cards_media_kind_idx ON public.cards (media_kind);
CREATE INDEX IF NOT EXISTS cards_sort_idx ON public.cards (pinned, sort_key, created_at);
CREATE INDEX IF NOT EXISTS cards_file_id_idx ON public.cards (file_id);
CREATE INDEX IF NOT EXISTS cards_file_sort_idx ON public.cards (file_id, pinned, sort_key, created_at);
```

**Verify**:

```sql
SELECT column_name FROM information_schema.columns
WHERE table_schema='public' AND table_name='cards'
  AND column_name IN ('title', 'source_url', 'site_name', 'preview_image_url', 'media_kind', 'media_path', 'media_thumb_path', 'media_mime', 'media_size', 'notes', 'sort_key', 'file_id');
```

### AI organize columns missing (optional for AI analysis)

**Symptom**: AI organize feature disabled, "AI" button hidden on cards.

**To enable AI organize**: Run in Supabase SQL Editor:

```sql
ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS ai_summary text;
ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS ai_tags text[];
ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS ai_action text;
ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS ai_model text;
ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS ai_updated_at timestamptz;
CREATE INDEX IF NOT EXISTS cards_ai_tags_idx ON public.cards USING gin(ai_tags);
CREATE INDEX IF NOT EXISTS cards_ai_action_idx ON public.cards (ai_action);
```

**Configure OpenAI API** (Vercel Dashboard > Project > Settings > Environment Variables):
- `OPENAI_API_KEY` — Your OpenAI API key
- `OPENAI_MODEL` — Model to use (default: `gpt-4o-mini`)

**Verify**:

```sql
SELECT column_name FROM information_schema.columns
WHERE table_schema='public' AND table_name='cards'
  AND column_name IN ('ai_summary', 'ai_tags', 'ai_action', 'ai_model', 'ai_updated_at');
```

**Usage**: Click "AI" button on any card (visible on hover). The API analyzes content and updates:
- `ai_summary`: One-line summary (max 100 chars)
- `ai_tags`: Array of 1-5 relevant tags
- `ai_action`: One of "buy", "read", "watch", "do", "hold"
- Cooldown: 24h per card (use `force=true` to override)

## 9. Storage: cards-media bucket (for uploaded images/videos)

**Purpose**: Store user-uploaded media files with thumbnails.

**Bucket**: `cards-media`

**Path convention**:
- Original: `${userId}/${cardId}/original.<ext>`
- Thumbnail: `${userId}/${cardId}/thumb.jpg`

**To create bucket** (Supabase Dashboard > Storage > Create bucket):
1. Name: `cards-media`
2. Public bucket: **No** (use signed URLs or make public based on your security model)
3. File size limit: 100MB (adjustable)
4. Allowed MIME types: `image/*,video/*`

**RLS Policies** (run in SQL Editor after creating bucket):

```sql
-- Allow authenticated users to upload to their own folder
CREATE POLICY "users_upload_own_media" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'cards-media' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow authenticated users to read their own media
CREATE POLICY "users_read_own_media" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'cards-media' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow authenticated users to delete their own media
CREATE POLICY "users_delete_own_media" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'cards-media' AND (storage.foldername(name))[1] = auth.uid()::text);
```

**Verify**:

```sql
SELECT * FROM storage.buckets WHERE name = 'cards-media';
SELECT name, COUNT(*) FROM storage.objects WHERE bucket_id = 'cards-media' GROUP BY name;
```

## 10. Migration: Add Files table (for organizing cards into collections)

Run this in **SQL Editor**:

```sql
-- Create files table
CREATE TABLE IF NOT EXISTS public.files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS files_user_id_idx ON public.files(user_id);

-- Add file_id to cards
ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS file_id uuid;

ALTER TABLE public.cards
  ADD CONSTRAINT cards_file_id_fkey
  FOREIGN KEY (file_id) REFERENCES public.files(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS cards_file_id_idx ON public.cards(file_id);

-- Enable RLS for files
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;

-- Files RLS policies
CREATE POLICY "files_select_own" ON public.files
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "files_insert_own" ON public.files
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "files_update_own" ON public.files
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "files_delete_own" ON public.files
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());
```

**Verify**:

```sql
-- Check files table
SELECT count(*) FROM files WHERE user_id = auth.uid();

-- Check file_id column
SELECT file_id, count(*) FROM cards GROUP BY file_id;
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

## 7. Chrome Extension

**Canonical source**: `tools/chrome-extension/save-to-shinen/`

**Distribution**: GitHub Releases (permanent, versioned)
- Download: https://github.com/array0224-cloud/stillframe-phase0/releases
- **Fully automated** — no manual tag creation required

**Release workflow** (zero manual steps):
1. Update `manifest.json` version (e.g., `"version": "1.0.1"`)
2. Merge to `main`
3. `extension_autotag.yml` auto-creates tag `v1.0.1`
4. `extension_release.yml` auto-creates GitHub Release with ZIP + SHA256

**Manual tag creation** (emergency fallback only):
```bash
git tag v1.0.0 && git push --tags
```
Only use if autotag workflow fails. Version must match `manifest.json`.

**Workflows**:
- `extension_autotag.yml` — Auto-creates tags when `manifest.json` changes on main (idempotent)
- `extension_release.yml` — Tag push `v*` → GitHub Release with ZIP + SHA256
- `extension_package.yml` — Manual trigger (testing/PR validation, 90-day artifact)

**Manual packaging**: `bash scripts/package_extension.sh` → creates `dist/save-to-shinen.zip`

**Release asset audit**: `scripts/audit_release_asset.sh [TAG]` audits the published GitHub Release asset (`save-to-shinen.zip` + `.sha256`) for install-friendly ZIP structure (root-level `manifest.json`, required files present, no `__MACOSX`/`.DS_Store`) and verifies the SHA256 checksum.

**Installation**: See `tools/chrome-extension/save-to-shinen/INSTALL.md`

## Related docs

- [OPS/supabase-setup.md](OPS/supabase-setup.md) — Full Supabase setup: table DDL, RLS policies, Google OAuth config, Storage bucket, env vars
- [OPS/deploy.md](OPS/deploy.md) — Vercel deploy guide: initial setup, env vars, verification steps
- [CLAUDE.md](CLAUDE.md) — Project conventions for AI-assisted development
