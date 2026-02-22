alter table if exists public.cards enable row level security;

drop policy if exists "Users can view own cards" on public.cards;
create policy "Users can view own cards"
  on public.cards for select
  using (auth.uid() = user_id);

drop policy if exists "Users can create own cards" on public.cards;
create policy "Users can create own cards"
  on public.cards for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own cards" on public.cards;
create policy "Users can update own cards"
  on public.cards for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own cards" on public.cards;
create policy "Users can delete own cards"
  on public.cards for delete
  using (auth.uid() = user_id);
