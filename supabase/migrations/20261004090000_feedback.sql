-- 의견함(feedback) + 신고 "처리 완료" 표시
-- Supabase SQL Editor에서 한 번 실행. 여러 번 실행해도 안전 (기존 데이터는 지우거나 바꾸지 않음)

create table if not exists public.feedback (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('bug', 'info', 'feature', 'etc')),  -- 버그 / 인원·정보 오류 / 기능 제안 / 기타
  body text not null check (char_length(btrim(body)) between 2 and 1000),
  contact text check (contact is null or char_length(contact) <= 100),   -- 선택 연락처 (관리자만 봄)
  page_url text check (page_url is null or char_length(page_url) <= 300), -- 어느 페이지에서 보냈는지 (사이트 내부 경로)
  ip_hash text not null,                                                  -- 도배 제한용 IP 해시 (원본 IP 저장 안 함)
  resolved_at timestamptz,                                                -- 관리자 "처리 완료" 시각
  created_at timestamptz not null default now()
);
create index if not exists feedback_created_idx on public.feedback (created_at desc);
create index if not exists feedback_ip_idx on public.feedback (ip_hash, created_at);

-- RLS: 브라우저(anon·authenticated)는 읽기·쓰기 전부 불가. 서버 API(service role)로만
alter table public.feedback enable row level security;
revoke all on public.feedback from anon, authenticated;

-- 신고 목록에서 "처리 완료" 표시 (신고 기록은 지우지 않고 시각만 남김)
alter table public.post_reports add column if not exists resolved_at timestamptz;

notify pgrst, 'reload schema';
