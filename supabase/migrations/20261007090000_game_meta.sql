-- GOTY 배지 · 같은 시리즈 · 공식 디스코드 (scripts/apply-game-meta.mjs가 채움)
-- Supabase SQL Editor에서 한 번 실행. 여러 번 실행해도 안전 (기존 데이터는 지우거나 바꾸지 않음)

-- 시리즈는 표를 따로 둔다: 이름을 한 곳에서 관리하고, games에는 어느 시리즈의 몇 번째인지만 기록
create table if not exists public.series (
  id bigint generated always as identity primary key,
  name_ko text not null unique,
  created_at timestamptz not null default now()
);

-- The Game Awards 올해의 게임 기록 — [{ "year": 2023, "result": "winner" | "nominee" }]
alter table public.games add column if not exists goty_awards jsonb;
-- 같은 시리즈 묶음 + 시리즈 안 출시 순서 (1부터)
alter table public.games add column if not exists series_id bigint references public.series(id) on delete set null;
alter table public.games add column if not exists series_order int;
-- 공식 디스코드 초대 주소 (https://discord.gg/...)
alter table public.games add column if not exists discord_url text;

create index if not exists games_series_id_idx on public.games(series_id) where series_id is not null;

alter table public.games drop constraint if exists games_discord_url_check;
alter table public.games add constraint games_discord_url_check
  check (discord_url is null or discord_url ~ '^https://(discord\.gg|discord\.com/invite)/[A-Za-z0-9-]+$');

-- 읽기 권한: games와 같게 — 브라우저 키는 읽기만, 쓰기는 서비스 키(스크립트)만
-- games의 새 칸은 games 표의 기존 권한·정책을 그대로 따른다
alter table public.series enable row level security;
revoke all on public.series from anon, authenticated;
grant select on public.series to anon, authenticated;
drop policy if exists "시리즈 공개 읽기" on public.series;
create policy "시리즈 공개 읽기" on public.series for select to anon, authenticated using (true);

notify pgrst, 'reload schema';
