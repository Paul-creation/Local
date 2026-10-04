-- 스팀 최근 평가(지난 30일) 칸 + 서버 방식 오류 수정
-- Supabase SQL Editor에서 한 번 실행. 여러 번 실행해도 안전 (행·가격 기록은 지우지 않음)

-- 1) 스팀 최근 평가 (scripts/enrich-recent-reviews.mjs, 매일 갱신)
--    한국 상점 페이지 "최근 평가" 줄 그대로: 지난 30일, 모든 언어
--    스팀이 최근 평가를 안 보여주면(30일 리뷰 10개 미만) pct·count·label은 null, recent_reviews_at만 기록
--    표시 규칙은 docs/recent-reviews.md
alter table public.games add column if not exists recent_review_pct smallint;
alter table public.games add column if not exists recent_review_count integer;
alter table public.games add column if not exists recent_review_label text;
alter table public.games add column if not exists recent_reviews_at timestamptz;

-- 2) 서버 방식: 스팀 공식 분류에 Online Co-op 또는 Online PvP가 있는데 '오프라인 전용'으로 들어간 게임 20개
--    → '온라인 + 오프라인' (fill-game-details.mjs의 Haiku 판단 오류, 아직 '오프라인 전용'인 행만 바꿈)
update public.games
set server_type = '온라인 + 오프라인'
where server_type = '오프라인 전용'
  and steam_appid in (
    '1086940',  -- Baldur's Gate 3 (Online Co-op)
    '1527950',  -- Wartales (Online Co-op)
    '2273430',  -- BlazBlue Entropy Effect (Online Co-op)
    '601150',   -- Devil May Cry 5 (Online Co-op)
    '936720',   -- Wrench (Online Co-op)
    '1794680',  -- Vampire Survivors (Online Co-op)
    '270880',   -- American Truck Simulator (Online Co-op)
    '2186680',  -- Warhammer 40,000: Rogue Trader (Online Co-op)
    '3263320',  -- Carry The Glass (Online Co-op)
    '2280',     -- DOOM + DOOM II (Online Co-op, Online PvP)
    '1637320',  -- Dome Keeper (Online Co-op, Online PvP)
    '2215430',  -- Ghost of Tsushima (Online Co-op, Online PvP)
    '637650',   -- FINAL FANTASY XV (Online Co-op, Online PvP)
    '1158310',  -- Crusader Kings III (Online PvP)
    '289070',   -- Civilization VI (Online PvP)
    '2835570',  -- Buckshot Roulette (Online PvP)
    '415600',   -- Kart Racing Pro (Online PvP)
    '261550',   -- Mount & Blade II: Bannerlord (Online PvP)
    '94400',    -- Nidhogg (Online PvP)
    '1342330'   -- Mad Games Tycoon 2 (Online PvP)
  );

notify pgrst, 'reload schema';
