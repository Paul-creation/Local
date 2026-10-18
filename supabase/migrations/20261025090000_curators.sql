create table if not exists public.curators (
  id uuid primary key default gen_random_uuid(),
  handle text not null unique,
  display_name text not null,
  instagram_url text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.curator_posts (
  id uuid primary key default gen_random_uuid(),
  curator_id uuid not null references public.curators(id) on delete cascade,
  game_id uuid not null references public.games(id) on delete cascade,
  post_url text not null,
  post_type text not null check (post_type in ('single', 'collection')),
  posted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (curator_id, game_id, post_url)
);
create index if not exists curator_posts_game_idx on public.curator_posts (game_id, posted_at desc);
create index if not exists curator_posts_curator_idx on public.curator_posts (curator_id, posted_at desc);

alter table public.curators enable row level security;
alter table public.curator_posts enable row level security;
revoke all on public.curators from anon, authenticated;
revoke all on public.curator_posts from anon, authenticated;
grant select on public.curators to anon, authenticated;
grant select on public.curator_posts to anon, authenticated;
create policy "큐레이터 읽기" on public.curators for select to anon, authenticated using (true);
create policy "큐레이터 게시물 읽기" on public.curator_posts for select to anon, authenticated using (true);

notify pgrst, 'reload schema';
