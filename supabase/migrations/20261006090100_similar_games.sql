-- 비슷한 게임 추천: 공통 태그의 희귀도 가중치 합으로 점수를 매긴다
-- Supabase SQL Editor에서 한 번 실행. 여러 번 실행해도 안전 (함수만 만들거나 바꾸고 데이터는 건드리지 않음)
-- 점수 = 공통 태그마다 ln(노출 게임 수 / 그 태그를 가진 노출 게임 수)의 합 — 흔한 태그(액션 등)는 거의 0점, 드문 태그일수록 크게
-- 자기 자신과 숨긴 게임(games.hidden)은 제외, 점수가 p_min_score 미만이면 후보에서 뺀다 (후보가 p_limit보다 적으면 있는 만큼만)
-- 동점은 인기순 (heat_rank 작은 순, 값이 없으면 뒤로 → 리뷰 수 많은 순)
-- 쓰는 곳: app/games/[id]/page.tsx (내 PC 최소 사양 미달 게임을 브라우저에서 거르려고 p_limit을 넉넉히 받는다)
create or replace function public.similar_games(
  p_game_id uuid,
  p_limit int default 4,
  p_min_score double precision default 8
)
returns table (game_id uuid, score double precision)
language sql
stable
set search_path = public
as $$
  with total as (
    select count(*)::double precision as n from games where not hidden
  ),
  tag_df as (
    select gt.tag_id, count(*)::double precision as df
    from game_tags gt
    join games g on g.id = gt.game_id and not g.hidden
    group by gt.tag_id
  ),
  scored as (
    select gt.game_id as gid, round(sum(ln(total.n / tag_df.df))::numeric, 6)::double precision as sc
    from game_tags src
    join game_tags gt on gt.tag_id = src.tag_id and gt.game_id <> p_game_id
    join tag_df on tag_df.tag_id = src.tag_id
    cross join total
    where src.game_id = p_game_id
    group by gt.game_id
  )
  select s.gid, s.sc
  from scored s
  join games g on g.id = s.gid and not g.hidden
  where s.sc >= p_min_score
  order by s.sc desc, g.heat_rank asc nulls last, g.review_total desc nulls last, g.id
  limit greatest(p_limit, 0);
$$;

revoke all on function public.similar_games(uuid, int, double precision) from public;
grant execute on function public.similar_games(uuid, int, double precision) to anon, authenticated, service_role;

notify pgrst, 'reload schema';
