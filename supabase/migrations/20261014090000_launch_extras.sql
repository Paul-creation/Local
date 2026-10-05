-- 오픈 전 추가 기능: 크로스플레이 칸 + 추천 인원 투표 표
-- Supabase SQL Editor에서 한 번 실행. 여러 번 실행해도 안전 (기존 행·가격 기록은 지우거나 바꾸지 않음)

-- 1) 크로스플레이 — 스팀 카테고리 "Cross-Platform Multiplayer"(id 27)
--    true = 스팀이 크로스플레이 표시 / false = 카테고리는 있는데 크로스플레이 없음 / null = 모름(스팀 외 게임 포함)
--    채우기: scripts/fill-crossplay.mjs (미리보기 기본, --apply) · 새 게임은 scripts/bulk-import.mjs가 넣을 때 바로 채움
alter table public.games add column if not exists has_crossplay boolean;

-- 2) 추천 인원 투표 — 상세 "몇 명이서 할 때 제일 재밌었나요?" (멀티 게임만)
--    한 사람(브라우저 쿠키 기준) 한 게임에 한 표. 쓰기는 서버 API(app/api/player-votes)만, 브라우저는 읽기만
--    voter_hash: 익명 쿠키 값을 비밀 값과 섞은 해시 (원문 저장 안 함, 브라우저에는 공개하지 않음)
create table if not exists public.player_count_votes (
  id bigint generated always as identity primary key,
  game_id uuid not null references public.games(id) on delete cascade,
  choice text not null check (choice in ('1', '2', '3', '4', '5-8', '9+')),
  voter_hash text,
  created_at timestamptz not null default now()
);
create unique index if not exists player_count_votes_one_per_voter on public.player_count_votes (game_id, voter_hash);
create index if not exists player_count_votes_game_idx on public.player_count_votes (game_id);

alter table public.player_count_votes enable row level security;
revoke all on public.player_count_votes from anon, authenticated;
-- voter_hash는 빼고 공개 (칸 단위 권한)
grant select (id, game_id, choice, created_at) on public.player_count_votes to anon, authenticated;
drop policy if exists "추천 인원 투표 공개 읽기" on public.player_count_votes;
create policy "추천 인원 투표 공개 읽기" on public.player_count_votes for select to anon, authenticated using (true);

notify pgrst, 'reload schema';
