-- 필터 개편: 태그 나무(tags) · 게임별 태그(game_tags) · 진입장벽 · 혼자 플레이 단계 · 팀/서버 인원
-- Supabase SQL Editor에서 한 번 실행. 여러 번 실행해도 안전 (기존 데이터는 지우거나 바꾸지 않음)
-- 채우기: node --env-file=.env.local scripts/apply-filter-v2.mjs (미리보기) → --apply
-- 기존 games.tags(한국어 태그 배열)·games.difficulty는 그대로 둔다 — 새 구조 확인 후 따로 정리

-- 1) 태그 나무 — data/tags/tree.json
--    id: 스팀 태그는 스팀 태그 id, 묶음 칸(장르·플레이 방식 등)은 10000001부터 (tree.json의 num)
create table if not exists public.tags (
  id bigint primary key,
  key text not null unique,                 -- tree.json의 id ('t:19', 'g:genre')
  ko text not null,
  en text,
  parent_id bigint references public.tags(id) on delete restrict,
  depth smallint not null check (depth between 1 and 4),
  sort int not null default 0,              -- 같은 부모 안에서의 순서
  hidden_empty boolean not null default false, -- 우리 게임에 안 쓰여 화면에서 숨길 칸 (참고용 — 화면은 실제 게임 수로 숨김)
  created_at timestamptz not null default now()
);
create index if not exists tags_parent_idx on public.tags (parent_id);

-- 2) 게임별 태그 — data/tags/game-tags.json (스팀 태그 투표 기준 상위 최대 15개)
create table if not exists public.game_tags (
  game_id uuid not null references public.games(id) on delete cascade,
  tag_id bigint not null references public.tags(id) on delete cascade,
  votes int,                                -- 스팀 태그 투표 수
  rank smallint not null,                   -- 그 게임 안에서의 순서 (1부터, 투표 많은 순)
  primary key (game_id, tag_id)
);
create index if not exists game_tags_tag_idx on public.game_tags (tag_id);

-- 3) games 새 칸
alter table public.games add column if not exists entry_barrier text;
alter table public.games add column if not exists entry_barrier_reason text;
alter table public.games add column if not exists solo_mode text;
alter table public.games add column if not exists party_max int;
alter table public.games add column if not exists session_max int;

alter table public.games drop constraint if exists games_entry_barrier_check;
alter table public.games add constraint games_entry_barrier_check check (entry_barrier is null or entry_barrier in ('낮음', '보통', '높음'));
alter table public.games drop constraint if exists games_solo_mode_check;
alter table public.games add constraint games_solo_mode_check check (solo_mode is null or solo_mode in ('story', 'possible', 'none'));
alter table public.games drop constraint if exists games_party_max_check;
alter table public.games add constraint games_party_max_check check (party_max is null or party_max between 1 and 1000);
alter table public.games drop constraint if exists games_session_max_check;
alter table public.games add constraint games_session_max_check check (session_max is null or session_max between 1 and 1000);

-- 4) 읽기 권한: series와 같은 방식 — 브라우저 키는 읽기만, 쓰기는 서비스 키(스크립트)만
--    games의 새 칸은 games 표의 기존 권한·정책을 그대로 따른다
alter table public.tags enable row level security;
revoke all on public.tags from anon, authenticated;
grant select on public.tags to anon, authenticated;
drop policy if exists "태그 공개 읽기" on public.tags;
create policy "태그 공개 읽기" on public.tags for select to anon, authenticated using (true);

alter table public.game_tags enable row level security;
revoke all on public.game_tags from anon, authenticated;
grant select on public.game_tags to anon, authenticated;
drop policy if exists "게임 태그 공개 읽기" on public.game_tags;
create policy "게임 태그 공개 읽기" on public.game_tags for select to anon, authenticated using (true);

notify pgrst, 'reload schema';
