-- 오픈 준비: IP 해시 90일 파기 + 운영자 배지
-- Supabase SQL Editor에서 한 번 실행. 여러 번 실행해도 안전 (기존 데이터는 지우거나 바꾸지 않음)
-- 20261004090000_feedback.sql(feedback 테이블)을 먼저 실행한 뒤 실행할 것

-- 1) IP 해시 90일 파기 준비: 행은 지우지 않고 IP 해시 칸만 null로 비울 수 있게 NOT NULL 해제
--    (scripts/purge-ip-hash.mjs가 매일 90일 지난 칸을 비움. 도배 제한은 최근 24시간만 보므로 영향 없음)
alter table public.posts alter column ip_hash drop not null;
alter table public.post_comments alter column ip_hash drop not null;
alter table public.game_comments alter column ip_hash drop not null;
alter table public.feedback alter column ip_hash drop not null;
-- 신고 중복 방지 유니크(target_type, target_id, reporter_hash)는 null끼리 겹치지 않으므로 null 허용해도 안전
alter table public.post_reports alter column reporter_hash drop not null;
-- AI 이용 기록: 이제부터 IP 원문 대신 해시를 저장 (app/lib/aiGuard.ts)
alter table public.ai_calls alter column ip drop not null;
-- post_likes.voter_hash는 기본키라 그대로 두고, 스크립트가 무작위 값(expired:…)으로 바꿔 IP와 연결만 끊는다
-- game_votes.voter_hash는 이미 null 허용

-- 2) 운영자 배지: 관리자 로그인 상태로 쓴 글·댓글·의견 표시 (기존 행은 false)
alter table public.posts add column if not exists is_admin boolean not null default false;
alter table public.post_comments add column if not exists is_admin boolean not null default false;
alter table public.game_comments add column if not exists is_admin boolean not null default false;
-- game_comments는 칸 단위로 anon 읽기를 허용하므로 새 칸도 추가 (공개해도 되는 값)
grant select (is_admin) on public.game_comments to anon;

notify pgrst, 'reload schema';

-- ─── 선택 (필요할 때 직접 실행) ───────────────────────────────
-- (a) 지금까지 ai_calls에 IP 원문으로 저장된 값 비우기 (행은 남김). 실행하지 않아도 90일 뒤 자동으로 비워짐
-- update public.ai_calls set ip = null where ip is not null and ip !~ '^[0-9a-f]{32}$';
--
-- (b) 이미 운영자 닉네임으로 올린 글을 배지 글로 바꾸기 — 먼저 목록을 확인하고, 본인 글의 id만 골라 실행
-- select 'post' as t, id, nickname, created_at from public.posts where nickname ~* '운영자|운영진|관리자|admin'
-- union all select 'comment', id, nickname, created_at from public.post_comments where nickname ~* '운영자|운영진|관리자|admin'
-- union all select 'game_comment', id, nickname, created_at from public.game_comments where nickname ~* '운영자|운영진|관리자|admin';
-- update public.posts set is_admin = true where id in (/* 본인 글 id */);
-- update public.post_comments set is_admin = true where id in (/* 본인 댓글 id */);
-- update public.game_comments set is_admin = true where id in (/* 본인 의견 id */);
