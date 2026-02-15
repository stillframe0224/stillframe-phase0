-- ============================================
-- Cards Media Setup SQL
-- ============================================
-- Purpose: Add media columns to cards table and configure storage policies
-- Execute in: Supabase SQL Editor
-- Rerunnable: Yes (all statements use IF NOT EXISTS or DROP IF EXISTS)

-- ============================================
-- 1. Add media columns to cards table
-- ============================================
ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS media_kind text;
ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS media_path text;
ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS media_thumb_path text;
ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS media_mime text;
ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS media_size bigint;

-- ============================================
-- 2. Create index for media_kind
-- ============================================
CREATE INDEX IF NOT EXISTS cards_media_kind_idx ON public.cards (media_kind);

-- ============================================
-- 3. Verify columns (run separately to check)
-- ============================================
-- SELECT column_name FROM information_schema.columns
-- WHERE table_schema='public' AND table_name='cards'
--   AND column_name IN ('media_kind','media_path','media_thumb_path','media_mime','media_size');
-- Expected: 5 rows returned

-- ============================================
-- 4. Optional: Reload schema cache if PGRST204 errors persist
-- ============================================
-- SELECT pg_notify('pgrst', 'reload schema');

-- ============================================
-- 5. Storage policies for cards-media bucket
-- ============================================
-- Note: Bucket 'cards-media' must be created manually in Dashboard first
-- Dashboard > Storage > Create bucket > Name: cards-media, Public: ON

-- Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (rerunnable)
DROP POLICY IF EXISTS "cards-media insert" ON storage.objects;
DROP POLICY IF EXISTS "cards-media read"   ON storage.objects;

-- Policy: Allow authenticated users to upload to cards-media
CREATE POLICY "cards-media insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'cards-media' AND owner = auth.uid());

-- Policy: Allow public read access to cards-media
CREATE POLICY "cards-media read" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'cards-media');

-- ============================================
-- Fallback: If owner check causes 403 errors (Phase0 only)
-- ============================================
-- Uncomment below if upload fails with owner validation:
-- DROP POLICY IF EXISTS "cards-media insert" ON storage.objects;
-- CREATE POLICY "cards-media insert" ON storage.objects
--   FOR INSERT TO authenticated
--   WITH CHECK (bucket_id = 'cards-media');

-- ============================================
-- Verification queries
-- ============================================
-- Check if bucket exists (run in Dashboard or with proper permissions):
-- SELECT * FROM storage.buckets WHERE name = 'cards-media';

-- Check upload permissions (test after policy creation):
-- Should succeed with authenticated JWT token
