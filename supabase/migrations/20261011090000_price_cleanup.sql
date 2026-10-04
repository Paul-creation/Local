-- 가격 수집 정리 (한 파일로 모음): 3일 연속 실패 기록 칸 + 가격 유형 칸 + 가격 없는 게임 7개 정리
-- Supabase SQL Editor에서 한 번 실행. 여러 번 실행해도 안전 (행·가격 기록은 지우지 않음)
-- 20261010090000_price_check_status.sql 내용도 여기 들어 있음 (그 파일은 정리됨, 이미 실행했어도 다시 실행해도 됨)

-- 1) 매일 가격 단계에서 못 받은 게임 표시 (scripts/lib/price-check.mjs)
--    price_check_failed_since: 연속으로 못 받기 시작한 시각 (받으면 다시 null) → 3일 연속이면 디스코드 일일 요약에 이름이 뜸
--    price_check_note: 마지막으로 못 받은 이유
alter table public.games add column if not exists price_check_failed_since timestamptz;
alter table public.games add column if not exists price_check_note text;
create index if not exists games_price_check_failed_idx on public.games(price_check_failed_since) where price_check_failed_since is not null;

-- 2) 가격 유형: null = 보통 (가격 기록으로 표시)
--    subscription = 월 구독 (가격 대신 "월 구독"), check_store = 가격을 받을 곳이 없음 (가격 대신 "판매처에서 확인" + 판매처 링크)
--    값이 있는 게임은 매일 가격 수집·실패 알림에서 빠짐
alter table public.games add column if not exists price_type text;
do $$ begin
  alter table public.games add constraint games_price_type_check check (price_type in ('subscription', 'check_store'));
exception when duplicate_object then null;
end $$;

-- 3) 가격 없는 게임 7개 정리
-- GTA V 레거시(271590): 따로 팔지 않음 → 숨기고 GTA V 인핸스드(3240220)로 연결
update public.games
set hidden = true, merged_into = '85b31391-6bbe-4865-9e30-db84edc5bf59'
where id = '02d19c05-292f-4714-9e25-26595f272e19' and hidden = false;

-- 용과 같이3(1088710): 리마스터판이 전 세계에서 판매 중단. 대체판은 '용과 같이 극3 / 용과 같이3 외전 Dark Ties'(3937550)이지만
-- 다른 상품이라 번호만 바꾸면 옛 리마스터 가격 기록·역대 최저가(₩5,940)가 극3 가격으로 보임 → 숨김 (극3은 새 게임으로 추가 권장)
update public.games set hidden = true
where id = '96c90025-8609-4f83-b47f-19451a242f6c' and hidden = false;

-- 콜 오브 듀티®(1938090): 워존이 아니라 유료 시리즈(블랙 옵스 7·현대전 등)를 묶은 실행기 → 숨김
-- (워존은 따로 있는 무료 앱 1962663)
update public.games set hidden = true
where id = '08e71c25-b72b-426e-82e0-e4d595426932' and hidden = false;

-- World of Warcraft: 월 구독
update public.games set price_type = 'subscription'
where id = '5765dffa-f0ac-4e51-b309-da64801a4959' and price_type is null;

-- Monument Valley: ITAD가 옛 'Monument Valley'(기록 없음)에 연결돼 있었음 → 에픽 기록이 있는 'Panoramic Edition'으로
update public.games set itad_id = '018d937f-6198-708a-a04c-ad9e28abe4bc'
where id = '25dee082-c936-4b30-aea0-41639aa1ae4c' and itad_id = '018d937e-f485-7153-9b9c-8daae495cb9f';

-- 베리드 스타즈: 한국어 이름이라 ITAD 자동 매칭이 안 됐음 → 'BURIED STARS'
update public.games set itad_id = '018d937f-5aa9-7196-b931-f6ddfed526a8'
where id = 'bd9edebc-ad4a-458c-92b1-978f2e2c6dfc' and itad_id is null;

-- TerraScape: ITAD에 에픽 가격 기록이 없음 → 판매처에서 확인
update public.games set price_type = 'check_store'
where id = 'de6e058f-0d45-4020-80aa-2ed42356d409' and price_type is null;

-- 4) 숨긴 게임·가격 유형이 있는 게임은 실패 표시를 비움 (앞으로도 수집·알림에서 빠짐)
update public.games set price_check_failed_since = null, price_check_note = null
where (hidden or price_type is not null) and (price_check_failed_since is not null or price_check_note is not null);

notify pgrst, 'reload schema';
