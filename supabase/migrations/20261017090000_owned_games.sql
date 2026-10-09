-- 스팀 보유 게임 + OpenID nonce 재사용 차단
-- Supabase SQL Editor에서 한 번 실행. 여러 번 실행해도 안전하게 작성 (기존 데이터는 지우거나 바꾸지 않음)
-- 모든 표는 브라우저 키(anon·authenticated)에 전면 차단 — 서버(service role)로만 읽고 쓴다 (정책 없음)

-- 1) 스팀 로그인 응답(openid.response_nonce) 재사용 차단용 임시 표.
--    기록 테이블이 아니라 보안용 임시 표라 하루 지난 행은 로그인 콜백이 지운다 (nonce 유효 시간은 10분)
create table if not exists public.used_openid_nonces (
  nonce text primary key check (char_length(nonce) <= 255),
  used_at timestamptz not null default now()
);
create index if not exists used_openid_nonces_used_at_idx on public.used_openid_nonces (used_at);
alter table public.used_openid_nonces enable row level security;
revoke all on public.used_openid_nonces from anon, authenticated;

-- 2) users: 보유 게임 동기화 상태
alter table public.users add column if not exists owned_synced_at timestamptz;
alter table public.users add column if not exists owned_visibility text not null default 'unknown';
do $$ begin
  alter table public.users add constraint users_owned_visibility_check check (owned_visibility in ('public', 'private', 'unknown'));
exception when duplicate_object then null; end $$;

-- 3) 보유 게임 — 스팀 상태의 사본(캐시). 우리 카탈로그(games.steam_appid)에 있는 appid만 저장한다.
--    탈퇴(users 행 삭제) 때 on delete cascade로 같이 지워진다
create table if not exists public.user_owned_games (
  user_id uuid not null references public.users(id) on delete cascade,
  steam_appid integer not null,
  primary key (user_id, steam_appid)
);
alter table public.user_owned_games enable row level security;
revoke all on public.user_owned_games from anon, authenticated;

-- 4) 통째로 교체: 지우기 + 채우기 + 상태 갱신을 한 번에(한 트랜잭션) — 도중에 실패해도 예전 목록이 그대로 남는다.
--    games.steam_appid가 text라 문자열로 비교한다. 서버(service role)만 실행 가능
create or replace function public.replace_owned_games(p_user uuid, p_appids bigint[])
returns integer
language plpgsql
as $$
declare
  n integer;
begin
  delete from public.user_owned_games where user_id = p_user;
  insert into public.user_owned_games (user_id, steam_appid)
    select distinct p_user, g.steam_appid::integer
    from public.games g
    where g.steam_appid in (select x::text from unnest(p_appids) as x)
      and g.steam_appid ~ '^[0-9]{1,9}$';
  get diagnostics n = row_count;
  update public.users set owned_visibility = 'public', owned_synced_at = now() where id = p_user;
  return n;
end;
$$;
revoke all on function public.replace_owned_games(uuid, bigint[]) from public, anon, authenticated;
grant execute on function public.replace_owned_games(uuid, bigint[]) to service_role;
