alter table public.games add column if not exists players_store_checked_at timestamptz;
alter table public.games add column if not exists players_auto_at timestamptz;
