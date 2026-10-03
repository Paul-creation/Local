-- 게임 상세 "의견 달기" (game_comments) + 신고 테이블이 게임 의견 신고도 받게
-- Supabase SQL Editor에서 한 번 실행. 여러 번 실행해도 안전하게 작성 (기존 데이터는 지우거나 바꾸지 않음)

create table if not exists public.game_comments (
  id bigint generated always as identity primary key,
  game_id uuid not null references public.games(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 200),
  nickname text not null check (char_length(btrim(nickname)) between 2 and 12),
  password_hash text not null,   -- scrypt 해시만 저장 (평문 금지)
  ip_hash text not null,         -- 도배 제한용 IP 해시 (원본 IP 저장 안 함)
  report_count integer not null default 0,
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists game_comments_game_idx on public.game_comments (game_id, created_at desc);
create index if not exists game_comments_ip_idx on public.game_comments (ip_hash, created_at);

-- RLS: 브라우저(anon)는 숨김 아닌 의견의 공개 칸만 읽기. 쓰기·수정·삭제는 서버 API(service role)로만
alter table public.game_comments enable row level security;
revoke all on public.game_comments from anon, authenticated;
grant select (id, game_id, body, nickname, created_at) on public.game_comments to anon;
drop policy if exists "공개 의견만 읽기" on public.game_comments;
create policy "공개 의견만 읽기" on public.game_comments for select to anon using (hidden = false);

-- 신고: 게임 의견(game_comment)도 받기. 같은 사람 중복 신고는 기존 유니크 제약(target_type, target_id, reporter_hash)으로 1번만
alter table public.post_reports drop constraint if exists post_reports_target_type_check;
alter table public.post_reports add constraint post_reports_target_type_check
  check (target_type in ('post', 'comment', 'game_comment'));

-- API가 새 테이블을 바로 알아보게 스키마 캐시 새로고침
notify pgrst, 'reload schema';
