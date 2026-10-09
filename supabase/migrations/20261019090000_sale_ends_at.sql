-- 할인 종료 시각: price_history.sale_ends_at
-- 최신 가격 행(카드·상세가 현재가로 읽는 행)에만 채운다. ITAD prices/v3의 스팀 딜 expiry를 그대로 저장하고, 모르면 null (추정하지 않음)
-- 할인이 끝났거나 할인 중이 아니면 scripts/fill-sale-ends.mjs가 null로 비운다. 행은 지우지 않음
-- Supabase SQL Editor에서 실행. 여러 번 실행해도 안전
alter table public.price_history add column if not exists sale_ends_at timestamptz;

notify pgrst, 'reload schema';
