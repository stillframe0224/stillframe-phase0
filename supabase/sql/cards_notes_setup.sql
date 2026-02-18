-- ============================================
-- Cards Notes Column Setup
-- ============================================
-- Purpose: Add notes column to cards table for per-card memo storage.
-- Execute in: Supabase SQL Editor (Dashboard > SQL Editor > New query)
-- Rerunnable: Yes (uses IF NOT EXISTS)
--
-- After running this, the memo feature will persist notes in the DB.
-- Before this migration: notes fall back to localStorage (card:memo:<cardId>).

-- ============================================
-- 1. Add notes column to cards table
-- ============================================
ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS notes text;

-- ============================================
-- 2. Optional: Create index for has-memo filtering
-- ============================================
CREATE INDEX IF NOT EXISTS cards_notes_notnull_idx
  ON public.cards (id)
  WHERE notes IS NOT NULL AND notes != '';

-- ============================================
-- 3. Reload PostgREST schema cache (if PGRST204 errors persist)
-- ============================================
-- NOTIFY pgrst, 'reload schema';

-- ============================================
-- 4. Verify (run separately)
-- ============================================
-- SELECT column_name, data_type
-- FROM information_schema.columns
-- WHERE table_schema = 'public'
--   AND table_name = 'cards'
--   AND column_name = 'notes';
-- Expected: 1 row: notes | text
