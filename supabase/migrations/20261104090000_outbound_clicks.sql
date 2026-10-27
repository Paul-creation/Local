create table if not exists public.outbound_clicks (
  id uuid primary key default gen_random_uuid(),
  curator text not null,
  game_id uuid references public.games(id) on delete set null,
  target_url text not null,
  created_at timestamptz not null default now()
);
create index if not exists outbound_clicks_curator_idx on public.outbound_clicks (curator, created_at desc);

alter table public.outbound_clicks enable row level security;
revoke all on public.outbound_clicks from anon, authenticated;

notify pgrst, 'reload schema';
