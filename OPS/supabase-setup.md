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

## 9. Verify

1. Run `npm run dev`
2. Go to `http://localhost:3000/app`
3. You should be redirected to `/auth/login`
4. Sign in with Google or email
5. You should land on `/app` with an empty card grid
6. Type a thought and press Enter — card should appear
