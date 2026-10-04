-- 가격 수집이 조용히 멈춘 게임 찾기: 매일 가격 단계에서 가격을 못 받은 게임을 표시
-- Supabase SQL Editor에서 한 번 실행. 여러 번 실행해도 안전 (기존 행은 지우거나 바꾸지 않음, 새 칸은 null로 시작)
-- price_check_failed_since: 연속으로 못 받기 시작한 날 (받으면 다시 null) → 3일 연속이면 디스코드 일일 요약에 이름이 뜸
-- price_check_note: 마지막으로 못 받은 이유 (예: 가격 없음, 상점 정보 없음, 요청 제한)
alter table public.games add column if not exists price_check_failed_since timestamptz;
alter table public.games add column if not exists price_check_note text;
create index if not exists games_price_check_failed_idx on public.games(price_check_failed_since) where price_check_failed_since is not null;

notify pgrst, 'reload schema';
