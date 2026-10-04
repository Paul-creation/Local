-- AI 한도를 브라우저(익명 쿠키 ID) 기준으로 셈 (app/lib/aiGuard.ts)
-- Supabase SQL Editor에서 한 번 실행. 여러 번 실행해도 안전 (기존 행은 지우거나 바꾸지 않음, 새 칸은 null로 시작)
-- client_id에는 쿠키 ID 원문이 아니라 비밀 값을 섞은 해시를 저장. 90일 뒤 scripts/purge-ip-hash.mjs가 비움
alter table public.ai_calls add column if not exists client_id text;
create index if not exists ai_calls_client_kind_created_idx on public.ai_calls (client_id, kind, created_at);
create index if not exists ai_calls_ip_created_idx on public.ai_calls (ip, created_at);

notify pgrst, 'reload schema';
