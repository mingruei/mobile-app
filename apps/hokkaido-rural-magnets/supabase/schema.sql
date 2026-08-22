-- Run in Supabase Dashboard → SQL Editor
-- Cloud sync table for 登城紀錄 (castle visit progress)

create table if not exists public.castle_progress (
  user_id uuid primary key references auth.users (id) on delete cascade,
  progress_map jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.castle_progress enable row level security;

create policy "Users read own castle progress"
  on public.castle_progress
  for select
  using (auth.uid() = user_id);

create policy "Users insert own castle progress"
  on public.castle_progress
  for insert
  with check (auth.uid() = user_id);

create policy "Users update own castle progress"
  on public.castle_progress
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users delete own castle progress"
  on public.castle_progress
  for delete
  using (auth.uid() = user_id);

create or replace function public.set_castle_progress_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists castle_progress_updated_at on public.castle_progress;

create trigger castle_progress_updated_at
  before update on public.castle_progress
  for each row
  execute function public.set_castle_progress_updated_at();
