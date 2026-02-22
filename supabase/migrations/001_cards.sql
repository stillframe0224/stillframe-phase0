create extension if not exists pgcrypto;

create table if not exists public.cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null default 'idea'
    check (type in ('melody', 'idea', 'quote', 'task', 'feeling', 'image', 'fragment', 'dream', 'clip', 'file')),
  text text not null default '',
  px float8 not null default 0,
  py float8 not null default 0,
  z float8 not null default -100,
  source jsonb,
  media jsonb,
  file jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists on_cards_updated on public.cards;
create trigger on_cards_updated
  before update on public.cards
  for each row execute function public.handle_updated_at();

create index if not exists idx_cards_user_id on public.cards(user_id);
create index if not exists idx_cards_created_at on public.cards(user_id, created_at desc);
