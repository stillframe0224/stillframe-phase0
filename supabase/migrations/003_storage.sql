insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'shinen-files',
  'shinen-files',
  false,
  52428800,
  array[
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'video/mp4', 'video/webm', 'video/quicktime',
    'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4',
    'application/pdf'
  ]
)
on conflict (id) do nothing;

alter table if exists storage.objects enable row level security;

drop policy if exists "Users can upload own files" on storage.objects;
create policy "Users can upload own files"
  on storage.objects for insert
  with check (
    bucket_id = 'shinen-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can view own files" on storage.objects;
create policy "Users can view own files"
  on storage.objects for select
  using (
    bucket_id = 'shinen-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can delete own files" on storage.objects;
create policy "Users can delete own files"
  on storage.objects for delete
  using (
    bucket_id = 'shinen-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
