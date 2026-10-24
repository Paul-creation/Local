create table if not exists public.curator_game_queue (
  id uuid primary key default gen_random_uuid(),
  appid text not null,
  curator_id uuid not null references public.curators(id) on delete cascade,
  post_url text not null,
  post_type text not null default 'single' check (post_type in ('single', 'collection')),
  post_title text,
  posted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  imported_at timestamptz,
  unique (appid, curator_id, post_url)
);
create index if not exists curator_game_queue_pending_idx on public.curator_game_queue (created_at) where imported_at is null;

alter table public.curator_game_queue enable row level security;
revoke all on public.curator_game_queue from anon, authenticated;

notify pgrst, 'reload schema';
