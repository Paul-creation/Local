-- 새 게임 자동 연결: 태그 나무(game_tags) · 진입장벽 · 혼자 플레이 단계
-- Supabase SQL Editor에서 한 번 실행. 여러 번 실행해도 안전 (기존 데이터는 지우거나 바꾸지 않음)
-- 쓰는 곳: scripts/link-new-game-tags.mjs · scripts/judge-new-games.mjs · scripts/daily-summary.mjs

-- 1) 한 번 처리한 게임은 다시 처리하지 않게 표시
--    tags_linked_at: 스팀 태그를 받아 game_tags 연결까지 끝낸 시각 (연결할 태그가 0개여도 표시)
--    filter_ai_at: 진입장벽·혼자 플레이 AI 판단을 한 시각 (AI가 null로 답해도 표시 → 다시 묻지 않음)
alter table public.games add column if not exists tags_linked_at timestamptz;
alter table public.games add column if not exists filter_ai_at timestamptz;

-- 2) tree.json에 없는 새 스팀 태그 기록 (game_tags에는 저장하지 않음)
--    디스코드 일일 요약이 tree.json·excluded.json·merged.json에 아직 없는 것만 세서 알림
create table if not exists public.tag_unclassified (
  steam_tag_id bigint primary key,
  en text,
  ko text,
  game_count int not null default 0,       -- 이 태그가 기준을 넘은 게임 수 (누적)
  game_names text[] not null default '{}', -- 예시 게임 이름 (최대 10개)
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

-- 관리용 표: 브라우저 키로는 읽기·쓰기 모두 막음 (서비스 키 스크립트만)
alter table public.tag_unclassified enable row level security;
revoke all on public.tag_unclassified from anon, authenticated;

notify pgrst, 'reload schema';
