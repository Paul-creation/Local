create table if not exists public.game_similar (
  game_id uuid not null references public.games(id) on delete cascade,
  rank smallint not null check (rank between 1 and 50),
  similar_id uuid not null references public.games(id) on delete cascade,
  score real not null,
  primary key (game_id, rank)
);
create index if not exists game_similar_similar_idx on public.game_similar (similar_id);
alter table public.game_similar enable row level security;
revoke all on public.game_similar from anon, authenticated;
grant select on public.game_similar to anon, authenticated;
drop policy if exists "비슷한 게임 공개 읽기" on public.game_similar;
create policy "비슷한 게임 공개 읽기" on public.game_similar for select to anon, authenticated using (true);
notify pgrst, 'reload schema';
