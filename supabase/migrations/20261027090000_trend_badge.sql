alter table public.games add column if not exists trend_badge text;
alter table public.games add column if not exists trend_score numeric;
alter table public.games add column if not exists trend_at timestamptz;
create index if not exists games_trend_badge_idx on public.games (trend_badge) where trend_badge is not null;
notify pgrst, 'reload schema';
