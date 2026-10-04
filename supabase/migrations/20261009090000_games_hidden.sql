-- 중복 게임 정리: 지우지 않고 숨김 + 남긴 쪽으로 연결
-- Supabase SQL Editor에서 한 번 실행. 여러 번 실행해도 안전 (행·가격 기록은 지우지 않음)
-- hidden = true인 게임은 화면·검색·시리즈·sitemap에서 빠지고, 상세 주소로 들어오면 merged_into 게임으로 이동 (코드는 다음 커밋)

alter table public.games add column if not exists hidden boolean not null default false;
alter table public.games add column if not exists merged_into uuid references public.games(id) on delete set null;
create index if not exists games_hidden_idx on public.games(id) where hidden;

-- 디아블로 IV 중복: 배틀넷 행(4724c5b8)을 숨기고 스팀 행(176d658f)으로 연결
update public.games
set hidden = true, merged_into = '176d658f-b34f-4cf9-a63e-ffce2152e420'
where id = '4724c5b8-a2ee-49ef-9391-6132c066bc3b' and hidden = false;

notify pgrst, 'reload schema';
