-- 스팀 로그인 사용자 (users)
-- Supabase SQL Editor에서 한 번 실행. 여러 번 실행해도 안전하게 작성 (기존 데이터는 지우거나 바꾸지 않음)
--
-- 설계 메모
--  - 로그인은 사이트 서버가 스팀 OpenID를 직접 검증하고 서명 쿠키로 유지한다 (Supabase Auth 미사용).
--    그래서 이 표는 브라우저 키(anon·authenticated)에 전부 막고, 서버(service role)로만 읽고 쓴다.
--  - 이 표를 가리키는 하위 표(보유 게임·찜 등)는 나중에 `user_id uuid references public.users(id) on delete cascade`로 만든다.
--    → 회원 탈퇴 때 users 행 하나만 지우면 하위 표가 같이 지워진다. 이번에는 하위 표를 만들지 않는다.
--  - steam_id는 64비트 정수(17자리)라 JS 숫자로 못 다루므로 text로 저장한다.

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  steam_id text not null unique check (steam_id ~ '^[0-9]{17}$'),
  persona_name text check (persona_name is null or char_length(persona_name) <= 64),
  avatar_url text check (avatar_url is null or char_length(avatar_url) <= 300),
  created_at timestamptz not null default now(),
  last_login_at timestamptz
);

alter table public.users enable row level security;
revoke all on public.users from anon, authenticated;
-- 정책을 하나도 만들지 않는다 = 브라우저 키로는 읽기·쓰기 모두 불가
