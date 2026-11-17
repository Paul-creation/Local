// 사이트맵 /games/[id]의 lastmod — "상세 페이지 내용이 실제로 바뀐 날"만 쓴다 (오늘 날짜·빌드 시각을 넣으면 크롤러가 전부 다시 가져감)
// 쓰는 값: 가격 기록이 추가된 시각(price_history.checked_at — 가격·할인이 바뀔 때만 행이 생김, scripts의 changed-game-ids와 같은 기준), 스팀 마지막 업데이트(last_updated),
//   소개문이 새로 쓰인 시각(fun_description_at·description_ko_at), 게임이 들어온 시각(created_at, 최소값)
// 안 쓰는 값: 접속자·리뷰 수·추세(recent_reviews_at·trend_at·players_*_at 등) — 매일 바뀌어서 쓰면 매일 전부 바뀐 것처럼 보임
// 알려진 한계: 출시 전 데모·할인 종료일·출시 예정 순위처럼 시각이 안 남는 변경은 반영되지 않음 (출시 전환은 첫 가격 기록이 생기면서 반영됨)
export const LASTMOD_FIELDS = 'created_at, last_updated, fun_description_at, description_ko_at, price_history(checked_at)';

export type LastmodGame = {
  created_at?: string | null;
  last_updated?: string | null;
  fun_description_at?: string | null;
  description_ko_at?: string | null;
  price_history?: { checked_at?: string | null }[] | null;
};

// 앞으로의 시각(잘못 들어온 값)은 now로 자른다. 읽을 수 있는 날짜가 하나도 없으면 undefined(lastmod 생략)
export function gameLastmod(g: LastmodGame, now = Date.now()): Date | undefined {
  const times = [g.created_at, g.last_updated, g.fun_description_at, g.description_ko_at, ...(g.price_history || []).map((p) => p.checked_at)]
    .map((v) => (v ? new Date(v).getTime() : NaN))
    .filter((t) => Number.isFinite(t));
  if (!times.length) return undefined;
  return new Date(Math.min(Math.max(...times), now));
}
