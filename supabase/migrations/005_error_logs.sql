create table if not exists public.error_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  source text not null,
  error_code text,
  message text not null,
  context jsonb,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists idx_error_logs_user_id on public.error_logs(user_id);
create index if not exists idx_error_logs_created_at on public.error_logs(created_at desc);
create index if not exists idx_error_logs_source on public.error_logs(source);

alter table if exists public.error_logs enable row level security;

drop policy if exists "Users can insert own error logs" on public.error_logs;
create policy "Users can insert own error logs"
  on public.error_logs for insert
  with check (auth.uid() = user_id or user_id is null);

drop policy if exists "Users can view own error logs" on public.error_logs;
create policy "Users can view own error logs"
  on public.error_logs for select
  using (auth.uid() = user_id);
