# Supabase Media Setup Guide

## Overview
This guide covers the setup steps for enabling media upload functionality in the SHINEN app. The process involves executing SQL migrations and creating a storage bucket in Supabase Dashboard.

## Prerequisites
- Supabase project with `cards` table already created
- Admin access to Supabase Dashboard
- SQL Editor access in Supabase Dashboard

---

## Step 1: Execute SQL Migration

**Location**: `supabase/sql/cards_media_setup.sql`

**Instructions**:
1. Open Supabase Dashboard → SQL Editor
2. Copy the entire contents of `supabase/sql/cards_media_setup.sql`
3. Paste into SQL Editor
4. Click **Run**

**Expected Output**: SQL executes without errors

---

## Step 2: Verify Column Creation

Run this verification query in SQL Editor:

```sql
SELECT column_name FROM information_schema.columns
WHERE table_schema='public' AND table_name='cards'
  AND column_name IN ('media_kind','media_path','media_thumb_path','media_mime','media_size');
```

**Expected Result**: 5 rows returned

| column_name |
|-------------|
| media_kind |
| media_path |
| media_thumb_path |
| media_mime |
| media_size |

**If fewer than 5 rows**:
- Check SQL execution logs for errors
- Re-run the migration SQL

---

## Step 3: Handle PGRST204 Errors (if needed)

If you encounter `PGRST204` errors (column not found) after migration:

1. Run this command in SQL Editor:
```sql
SELECT pg_notify('pgrst', 'reload schema');
```

2. Wait 1-2 minutes for PostgREST to reload the schema cache
3. Test again

---

## Step 4: Create Storage Bucket

**Manual step (Dashboard only)**:

1. Navigate to: **Supabase Dashboard → Storage → Create bucket**
2. Configure:
   - **Name**: `cards-media`
   - **Public bucket**: **ON** (required for `getPublicUrl()`)
   - **File size limit**: 100MB (recommended)
   - **Allowed MIME types**: `image/*,video/*`
3. Click **Create bucket**

**Verify**: Check that `cards-media` appears in the Storage bucket list with **Public** status ON.

---

## Step 5: Test in Production

Open your deployed app and test the upload flow:

### A) Image Upload Test

1. Navigate to `/app`
2. Click **+** → **Upload**
3. Select a small image file (JPEG/PNG)
4. Open browser DevTools → Network tab
5. Verify:

| Request | Expected Status | Error Diagnosis |
|---------|-----------------|-----------------|
| `POST /storage/v1/object/...` | 200/201 | 401/403 → Check insert policy |
| Thumbnail `GET` | 200 | 403 → Bucket not public or read policy missing |
| `PATCH /rest/v1/cards?id=eq...` | 200/204 | 400/PGRST204 → Columns not added or schema cache |

### B) Video Upload Test

1. Upload a small MP4 file
2. Verify thumbnail shows frame at 0.2s
3. Reload page and confirm thumbnail persists

---

## Troubleshooting

### Issue: POST returns 401/403

**Cause**: Insert policy not applied or owner validation failing

**Fix**:
```sql
-- Run fallback policy (Phase0 only)
DROP POLICY IF EXISTS "cards-media insert" ON storage.objects;
CREATE POLICY "cards-media insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'cards-media');
```

### Issue: Thumbnail GET returns 403

**Cause**: Bucket is not public or read policy missing

**Fix**:
1. Check bucket public setting: Dashboard → Storage → `cards-media` → Settings → Public ON
2. Verify read policy exists (already in migration SQL)

### Issue: PATCH returns PGRST204

**Cause**: PostgREST schema cache not updated

**Fix**:
```sql
SELECT pg_notify('pgrst', 'reload schema');
```
Wait 1-2 minutes and retry.

---

## Architecture

### Storage Bucket Structure
```
cards-media/
  {userId}/
    {cardId}/
      original.{ext}  ← Original uploaded file
      thumb.jpg       ← Generated thumbnail (512px max)
```

### Database Schema
```sql
cards table additions:
- media_kind: text        -- 'image' | 'video'
- media_path: text        -- Storage path to original
- media_thumb_path: text  -- Storage path to thumbnail
- media_mime: text        -- MIME type (e.g., 'image/jpeg')
- media_size: bigint      -- File size in bytes
```

### Security Model
- **Upload**: Authenticated users only, validated by `auth.uid()`
- **Read**: Public access (supports `getPublicUrl()`)
- **Path isolation**: Files stored under `{userId}/` prefix

---

## Summary Checklist

- [ ] SQL migration executed (`supabase/sql/cards_media_setup.sql`)
- [ ] 5 columns verified in `cards` table
- [ ] Storage bucket `cards-media` created (Public ON)
- [ ] Image upload test passed (200/201 responses)
- [ ] Video upload test passed (thumbnail at 0.2s)
- [ ] No PGRST204 errors (schema cache reloaded if needed)

**Next Steps**: Monitor upload logs and consider switching to signed URLs (private bucket) if needed for enhanced security.
