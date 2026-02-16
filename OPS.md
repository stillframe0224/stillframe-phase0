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

**One-button patch release**: Run `bash scripts/release_extension_patch.sh` to automatically bump the patch version, verify the ZIP structure (manifest at root), commit/push to main, wait for the GitHub Release to be created with assets, and audit the published ZIP. The script ensures end-to-end validation from version bump to verified release.

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

**Desktop push notify (ntfy)**: Codexは必ず `scripts/codex-run-notify` 経由のみで実行する。`NTFY_TOPIC` は必須（未設定なら実行しない/exit 64）で、`.env.local` 例: `NTFY_TOPIC=your-private-topic`（必要なら `NTFY_SERVER` / 認証も定義）。通知優先度は `done=3`, `fail=4`, `critical=4`, `warning/done/complete=3`。RWL連携は `RWL_NOTIFY=1` で `node tools/notify/rwl-status-hook.mjs [status.json path]` を status 更新時に呼ぶ。

```bash
# 1) 引数PROMPT
bash scripts/codex-run-notify "Explain repo structure briefly"

# 2) stdin PROMPT
cat <<'EOF' | bash scripts/codex-run-notify
List top 3 risks in this repo.
EOF

# 3) 失敗時のexit code確認
bash -lc 'tmp=$(mktemp -d); printf "#!/usr/bin/env bash\nexit 7\n" > "$tmp/codex"; chmod +x "$tmp/codex"; PATH="$tmp:$PATH" bash scripts/codex-run-notify "test"; echo EXIT:$?'
```

## 8. Codex: Project-Local State & Stream Resilience

**Entry Point**: `scripts/codex-safe` (only way to invoke `codex exec`)

401対策: `scripts/codex-safe` は認証を自動復旧します（`~/.codex/auth.json` 移植 → `OPENAI_API_KEY` 無人ログイン → device-auth）。device-auth が必要な場合は Pixel に `🔐 Codex login required`（Priority 4）を送信します。
codex-safe は iMac でローカル音を鳴らします（Pixel不要）。無効化は `IMAC_SOUND=0`。

**Why**: Prevents `~/.codex/sessions` permission errors and eliminates stream disconnect failures via auto-retry + resume.

### Architecture

**CODEX_HOME**: Always set to `.rwl/codex-home/` (repo-local, gitignored)
- First run auto-generates `config.toml` with OpenAI provider tuning:
  - `request_max_retries = 10`
  - `stream_max_retries = 25`
  - `stream_idle_timeout_ms = 900000` (15 min)
- Subsequent runs reuse existing config (no overwrites)
- Sessions stored locally → no cross-repo permission conflicts

**Retry Logic**:
- Max attempts: 8 (up from 3)
- Exponential backoff: 1s, 2s, 4s, 8s, 16s (capped)
- Stream disconnect detection: greps output for `stream.*disconnect|connection.*reset|timeout`
- Auto-resume: On stream error, runs `codex exec resume --last --cd "$ROOT" "continue"` once per attempt
- Non-stream errors: Skip resume, proceed to next attempt

**Notifications** (ntfy):
- Success: Priority 3 (✅ Codex Success)
- Failure: Priority 4 (❌ Codex Failed)
- Recovery: Priority 3 (✅ Codex Recovered)

### Usage

```bash
# Standard invocation (from anywhere)
cd /Users/array0224/stillframe-phase0
scripts/codex-safe "Summarize CLAUDE.md in 3 bullet points"

# First run (auto-generates config)
# → Creates .rwl/codex-home/config.toml
# → Runs codex with --cd "$ROOT"

# Stream disconnect scenario
# → Attempt 1 fails with "stream disconnect"
# → Auto-resume with "continue"
# → If resume succeeds → exit 0 + notify
# → If resume fails → backoff → attempt 2

# All attempts exhausted
# → Sends Pixel (Priority 4) notification
# → Exit code 1
```

### Verification

```bash
# 1) Config auto-generated
cat .rwl/codex-home/config.toml
# Should show: [model_providers.openai] with stream_max_retries=25

# 2) Quick smoke test
scripts/codex-safe "Say 'pong' and stop."
# Should succeed on attempt 1, send Priority 3 notification

# 3) Force failure (codex not in PATH)
PATH="/tmp:$PATH" scripts/codex-safe "test"
# Should fail after 8 attempts, send Priority 4 notification
```

### Files

- `scripts/codex-safe` — Wrapper script (chmod +x)
- `.rwl/codex-home/` — Runtime state (gitignored)
- `.gitignore` — Excludes `.rwl/codex-home/`

### Critical Invariants

1. **Never invoke `codex` directly** — always use `scripts/codex-safe`
2. **CODEX_HOME is always repo-local** — prevents `~/.codex/sessions` permission errors
3. **--cd "$ROOT" on every exec** — prevents session cross-contamination
4. **config.toml is never overwritten** — first-run only, preserves user edits
5. **Auto-heal on startup** — `scripts/codex-safe` auto-repairs `.rwl/codex-home/config.toml` if `[model_providers.openai]` is missing `name` field (required by Codex)

### Extension Release: Failure Modes & Mitigations

#### Top 10 Failure Modes

**1) Autotag never runs**
- **Symptom**: No new tag `vX.Y.Z` after merging to `main`.
- **Likely root cause**: `extension_autotag.yml` trigger not matching (missing `paths` filter or manifest not changed).
- **Fast check**: `git show --name-only HEAD | rg '^tools/chrome-extension/save-to-shinen/manifest\.json$'`
- **Fix**: Commit a manifest version change on `main` (bump `"version"` in `tools/chrome-extension/save-to-shinen/manifest.json`).

**2) Autotag runs but creates no tag (version unchanged)**
- **Symptom**: Autotag workflow logs show "Version unchanged; skipping tag."
- **Likely root cause**: `manifest.json` changed but `.version` stayed the same (formatting-only change).
- **Fast check**: `git show HEAD:tools/chrome-extension/save-to-shinen/manifest.json | node -p 'JSON.parse(require("fs").readFileSync(0,"utf8")).version'`
- **Fix**: Bump patch version (X.Y.Z -> X.Y.(Z+1)) and push to `main`.

**3) Autotag fails semver validation**
- **Symptom**: Autotag job errors like "version is not semver-like (expected X.Y.Z)".
- **Likely root cause**: Version includes suffix (e.g., `1.0.0-beta`) or is missing.
- **Fast check**: `node -p 'require("./tools/chrome-extension/save-to-shinen/manifest.json").version'`
- **Fix**: Set version to strict `X.Y.Z` in `manifest.json`.

**4) Autotag skips because tag already exists (idempotent no-op)**
- **Symptom**: Workflow logs show "Tag already exists on remote … (skipping)".
- **Likely root cause**: Tag was already pushed (manual tag, re-run, or re-merge).
- **Fast check**: `git ls-remote --tags origin "refs/tags/v$(node -p 'require("./tools/chrome-extension/save-to-shinen/manifest.json").version')"`
- **Fix**: Bump version again (patch) to generate a new tag.

**5) Duplicate/racing tag creation attempts**
- **Symptom**: One run fails with "tag already exists" or intermittent tag push failures.
- **Likely root cause**: Parallel pushes to `main`; concurrency misconfigured.
- **Fast check**: `rg -n "concurrency:" .github/workflows/extension_autotag.yml`
- **Fix**: Ensure `concurrency.group: extension-autotag` and `cancel-in-progress: true`.

**6) Release workflow doesn't run after tag**
- **Symptom**: Tag exists, but no GitHub Release appears.
- **Likely root cause**: trigger/permissions misconfigured.
- **Fast check**: `rg -n "tags:|permissions:" .github/workflows/extension_release.yml`
- **Fix**: Ensure tag trigger `v*` + permissions allow creating releases/assets.

**7) Release ZIP not install-friendly (manifest not at ZIP root)**
- **Symptom**: Chrome "Load unpacked" requires nested folder selection.
- **Likely root cause**: packaging script zipped with prefix / wrong cwd.
- **Fast check**: `bash scripts/verify_extension_zip.sh`
- **Fix**: zip from `tools/chrome-extension/save-to-shinen/` so entries are root-level.

**8) ZIP contains macOS junk (`__MACOSX/` / `.DS_Store`)**
- **Symptom**: verify/audit fails due to junk entries.
- **Fast check**: `unzip -Z1 dist/save-to-shinen.zip | rg '(__MACOSX/|\.DS_Store$)' || true`
- **Fix**: rebuild using `scripts/package_extension.sh`.

**9) Published asset SHA256 mismatch**
- **Symptom**: `scripts/audit_release_asset.sh` fails with mismatch.
- **Fast check**: `bash scripts/audit_release_asset.sh "v$(node -p 'require("./tools/chrome-extension/save-to-shinen/manifest.json").version')"`
- **Fix**: bump version and release a new tag (avoid asset replacement).

**10) GitHub token/permissions prevent tagging or release creation**
- **Symptom**: permission denied pushing tag / creating release.
- **Fast check**: `rg -n "permissions:" .github/workflows/extension_autotag.yml .github/workflows/extension_release.yml`
- **Fix**: restore `permissions: contents: write` where needed.

#### Runbook (6 Commands Max)

```bash
node -p 'require("./tools/chrome-extension/save-to-shinen/manifest.json").version'
git show --name-only HEAD | rg '^tools/chrome-extension/save-to-shinen/manifest\.json$'
git ls-remote --tags origin "refs/tags/v$(node -p 'require("./tools/chrome-extension/save-to-shinen/manifest.json").version')"
bash scripts/verify_extension_zip.sh
bash scripts/audit_release_asset.sh "v$(node -p 'require("./tools/chrome-extension/save-to-shinen/manifest.json").version')"
gh run list --limit 10
```

## Related docs

- [OPS/supabase-setup.md](OPS/supabase-setup.md) — Full Supabase setup: table DDL, RLS policies, Google OAuth config, Storage bucket, env vars
- [OPS/deploy.md](OPS/deploy.md) — Vercel deploy guide: initial setup, env vars, verification steps
- [CLAUDE.md](CLAUDE.md) — Project conventions for AI-assisted development
