-- 가능한 활동 제보 (빠진 활동 추가 / 틀린 활동 신고)
-- Supabase SQL Editor에서 한 번 실행. 여러 번 실행해도 안전 (기존 데이터는 지우거나 바꾸지 않음)

create table if not exists public.game_activity_reports (
  id bigint generated always as identity primary key,
  game_id uuid not null references public.games(id) on delete cascade,
  activity_key text not null check (activity_key ~ '^[a-z_]{2,30}$'),     -- 분류표 키 (app/lib/activities.ts, 서버가 목록으로 한 번 더 검사)
  kind text not null check (kind in ('missing', 'wrong')),               -- missing = 빠진 활동 / wrong = 틀린 활동
  voter_hash text,                                                        -- IP 해시 (원본 IP 저장 안 함, 90일 뒤 purge-ip-hash가 비움)
  resolved_at timestamptz,                                                -- 관리자가 승인·무시한 시각
  resolution text check (resolution is null or resolution in ('approved', 'dismissed')),
  created_at timestamptz not null default now()
);

-- 같은 사람이 같은 게임·활동·종류를 또 제보하면 무시 (voter_hash가 비워진 행끼리는 겹치지 않음)
create unique index if not exists game_activity_reports_once_idx
  on public.game_activity_reports (game_id, activity_key, kind, voter_hash);
create index if not exists game_activity_reports_voter_idx on public.game_activity_reports (voter_hash, created_at);
create index if not exists game_activity_reports_open_idx on public.game_activity_reports (game_id, activity_key) where resolved_at is null;

-- RLS: 브라우저(anon·authenticated)는 읽기·쓰기 전부 불가. 서버 API(service role)로만 insert
-- (anon이 직접 insert하면 voter_hash를 마음대로 바꿔 "서로 다른 제보자 3명"을 만들 수 있어서 막음)
alter table public.game_activity_reports enable row level security;
revoke all on public.game_activity_reports from anon, authenticated;

notify pgrst, 'reload schema';
