# Supabase Setup for SHINEN Lite

## 1. Create a Supabase project

1. Go to https://supabase.com/dashboard
2. Click **New project**
3. Name it `shinen-lite` (or whatever you prefer)
4. Choose a region close to your users
5. Set a database password (save it)
6. Wait for the project to be provisioned

## 2. Get your keys

Go to **Settings > API** in your Supabase dashboard.

Copy these values:
- **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
- **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Set them in your `.env.local` (for dev) and Vercel Environment Variables (for production).

## 3. Create the `cards` table

Go to **SQL Editor** in your Supabase dashboard and run:

```sql
create table cards (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  text text not null,
  card_type text not null default 'idea',
  image_url text,
  image_source text check (image_source in ('ogp', 'upload', 'generated')),
  client_request_id text unique,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- RLS: Users can only access their own cards
alter table cards enable row level security;

create policy "Users can view own cards"
  on cards for select using (auth.uid() = user_id);

create policy "Users can insert own cards"
  on cards for insert with check (auth.uid() = user_id);

create policy "Users can update own cards"
  on cards for update using (auth.uid() = user_id);

create policy "Users can delete own cards"
  on cards for delete using (auth.uid() = user_id);
```

## 4. Set up Authentication

### Google OAuth (recommended)

1. Go to **Authentication > Providers** in Supabase dashboard
2. Enable **Google**
3. You need a Google OAuth client:
   - Go to https://console.cloud.google.com/apis/credentials
   - Create an OAuth 2.0 Client ID (Web application)
   - Authorized redirect URI: `https://<your-project-ref>.supabase.co/auth/v1/callback`
4. Copy the Client ID and Client Secret into the Supabase Google provider settings
5. Save

### Magic Link (email)

Already enabled by default in Supabase. No extra configuration needed.

### Redirect URLs

Go to **Authentication > URL Configuration**:
- **Site URL**: `https://your-domain.vercel.app` (or `http://localhost:3000` for dev)
- **Redirect URLs**: Add both:
  - `http://localhost:3000/auth/callback`
  - `https://your-domain.vercel.app/auth/callback`

## 5. Set up Storage (for image uploads)

1. Go to **Storage** in Supabase dashboard
2. Click **New bucket**
3. Name: `card-images`
4. **Public bucket**: Yes (so images can be displayed without auth)
5. Click **Create bucket**

Then add a storage policy — go to **Storage > Policies** for `card-images`:

```sql
-- Allow authenticated users to upload to their own folder
create policy "Users can upload own images"
  on storage.objects for insert
  with check (
    bucket_id = 'card-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Allow public read access
create policy "Public read access"
  on storage.objects for select
  using (bucket_id = 'card-images');
```

## 6. Environment Variables

### Local development (.env.local)

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxxxx
```

### Vercel

Go to your Vercel project > Settings > Environment Variables and add the same two variables.

## 7. Migration: Add idempotency column (existing deployments)

If you already have a `cards` table, run this in **SQL Editor**:

```sql
-- Add client_request_id for insert idempotency
alter table cards add column if not exists client_request_id text;
alter table cards add constraint cards_client_request_id_key unique (client_request_id);
```

This column is nullable so existing rows are unaffected.

## 8. Migration: Add pinned column (optional, for card pinning feature)

If you want to enable the pin/star feature for cards, run this in **SQL Editor**:

```sql
-- Add pinned flag for card pinning feature
alter table cards add column if not exists pinned boolean default false;

-- Index for efficient pinned + date sorting
create index if not exists cards_pinned_created_at_idx on cards (pinned, created_at);
```

**Verify**:

```sql
select pinned, count(*) from cards group by pinned;
```

This column is optional; the app works without it (pinning UI will be hidden if the column doesn't exist).

## 9. Migration: Add metadata columns (for rich link previews and media uploads)

Run this in **SQL Editor**:

```sql
-- Add metadata columns for rich cards
alter table public.cards add column if not exists title text;
alter table public.cards add column if not exists source_url text;
alter table public.cards add column if not exists site_name text;
alter table public.cards add column if not exists preview_image_url text;
alter table public.cards add column if not exists media_kind text;
alter table public.cards add column if not exists media_path text;
alter table public.cards add column if not exists media_thumb_path text;
alter table public.cards add column if not exists media_mime text;
alter table public.cards add column if not exists media_size bigint;
alter table public.cards add column if not exists notes text;
alter table public.cards add column if not exists sort_key text;
alter table public.cards add column if not exists file_id uuid;
alter table public.cards add column if not exists updated_at timestamptz default now();

-- Index for source URL lookups
create index if not exists cards_source_url_idx on public.cards (source_url);
create index if not exists cards_site_name_idx on public.cards (site_name);
create index if not exists cards_media_kind_idx on public.cards (media_kind);
create index if not exists cards_sort_idx on public.cards (pinned, sort_key, created_at);
create index if not exists cards_file_id_idx on public.cards (file_id);
create index if not exists cards_file_sort_idx on public.cards (file_id, pinned, sort_key, created_at);
```

**Verify**:

```sql
select column_name from information_schema.columns
where table_schema='public' and table_name='cards'
  and column_name in ('title', 'source_url', 'site_name', 'preview_image_url', 'media_kind', 'media_path', 'media_thumb_path', 'media_mime', 'media_size', 'notes', 'sort_key', 'file_id');
```

## 10. Migration: Add Files table (for organizing cards)

Run this in **SQL Editor**:

```sql
-- Create files table
create table if not exists public.files (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  created_at timestamptz not null default now()
);

create index if not exists files_user_id_idx on public.files(user_id);

-- Add file_id to cards
alter table public.cards add column if not exists file_id uuid;

alter table public.cards
  add constraint cards_file_id_fkey
  foreign key (file_id) references public.files(id) on delete set null;

create index if not exists cards_file_id_idx on public.cards(file_id);

-- Enable RLS for files
alter table public.files enable row level security;

-- Files RLS policies
create policy "files_select_own" on public.files
  for select to authenticated
  using (user_id = auth.uid());

create policy "files_insert_own" on public.files
  for insert to authenticated
  with check (user_id = auth.uid());

create policy "files_update_own" on public.files
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "files_delete_own" on public.files
  for delete to authenticated
  using (user_id = auth.uid());
```

**Verify**:

```sql
-- Check files table
select count(*) from files where user_id = auth.uid();

-- Check file_id column
select file_id, count(*) from cards group by file_id;
```

These columns enable:
- `title`: Card title (extracted from bookmarklet or auto-generated from filename)
- `source_url`: Original URL (for link cards)
- `site_name`: Site name (extracted from og:site_name via bookmarklet)
- `preview_image_url`: Pre-extracted preview image (from bookmarklet or API)
- `media_kind`: Type of card ('link', 'image', 'video', 'note')
- `media_path`: Supabase Storage path for uploaded media
- `media_thumb_path`: Thumbnail path for videos/images
- `media_mime`: MIME type of uploaded media (e.g., 'image/jpeg', 'video/mp4')
- `media_size`: File size in bytes

## 11. Storage: cards-media bucket (for uploaded images/videos)

**Purpose**: Store user-uploaded media files with thumbnails.

**To create the bucket** (Supabase Dashboard > Storage > New bucket):
1. Name: `cards-media`
2. Public bucket: **No** (use signed URLs or make public based on your security model)
3. File size limit: 100MB (adjustable)
4. Allowed MIME types: `image/*,video/*`

**Path convention**:
- Original: `${userId}/${cardId}/original.<ext>`
- Thumbnail: `${userId}/${cardId}/thumb.jpg`

**RLS Policies** (run in SQL Editor after creating bucket):

```sql
-- Allow authenticated users to upload to their own folder
create policy "users_upload_own_media" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'cards-media' and (storage.foldername(name))[1] = auth.uid()::text);

-- Allow authenticated users to read their own media
create policy "users_read_own_media" on storage.objects
  for select to authenticated
  using (bucket_id = 'cards-media' and (storage.foldername(name))[1] = auth.uid()::text);

-- Allow authenticated users to delete their own media
create policy "users_delete_own_media" on storage.objects
  for delete to authenticated
  using (bucket_id = 'cards-media' and (storage.foldername(name))[1] = auth.uid()::text);
```

**Verify**:

```sql
select * from storage.buckets where name = 'cards-media';
select name, count(*) from storage.objects where bucket_id = 'cards-media' group by name;
```

## 12. Verify

1. Run `npm run dev`
2. Go to `http://localhost:3000/app`
3. You should be redirected to `/auth/login`
4. Sign in with Google or email
5. You should land on `/app` with an empty card grid
6. Type a thought and press Enter — card should appear
