create table if not exists public.review_history (
  snapshot_date date not null,
  game_id uuid not null references public.games(id) on delete cascade,
  review_total integer,
  review_positive_percent smallint,
  primary key (snapshot_date, game_id)
);
create index if not exists review_history_game_idx on public.review_history (game_id, snapshot_date desc);
alter table public.review_history enable row level security;
revoke all on public.review_history from anon, authenticated;
grant select on public.review_history to anon;
create policy "리뷰 기록 읽기" on public.review_history for select to anon using (true);
notify pgrst, 'reload schema';
