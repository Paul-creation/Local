-- 정가 원본 저장: price_history.original_price
-- 스팀 appdetails price_overview.initial(÷100), ITAD deal.regular.amount, 에픽 등 다른 상점의 originalPrice를 그대로 저장한다
-- (예전에는 최종가와 할인율로 거꾸로 계산해서 ₩20,500이 ₩20,491로 보였음 → app/lib/price.ts의 getPriceInfo)
-- null = 아직 모름 (기존 행). 값은 이미 있는 행을 덮어쓰지 않고 null인 칸만 채운다. 행은 지우지 않음
-- Supabase SQL Editor에서 실행. 여러 번 실행해도 안전
alter table public.price_history add column if not exists original_price numeric;
-- 100원 미만은 달러로 잘못 들어온 값이라 getPriceInfo가 이미 제외하는 기준과 같게 막음
do $$ begin
  alter table public.price_history add constraint price_history_original_price_check
    check (original_price is null or original_price >= 100);
exception when duplicate_object then null;
end $$;

notify pgrst, 'reload schema';
