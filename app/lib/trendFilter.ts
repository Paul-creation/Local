// 검색 "지금 뜨는 게임" 필터 — 순수 함수라 trendFilter.test.mjs가 .ts를 바로 불러온다 (다른 파일을 import하지 않는다)
// 하위 선택 둘: 신작(trend_badge = new) · 인기 급상승(rising_old + rising_recent). 둘 다 켜면 합집합. 주소는 ?trend=new,rising
export const TRENDS = [['new', '신작'], ['rising', '인기 급상승']] as const;
export type TrendKey = (typeof TRENDS)[number][0];

const BADGES_OF: Record<TrendKey, string[]> = { new: ['new'], rising: ['rising_old', 'rising_recent'] };

export const trendFromUrl = (v: string | null): TrendKey[] => (v || '').split(',').filter((x): x is TrendKey => TRENDS.some(([k]) => k === x));
export const trendToUrl = (list: TrendKey[]) => TRENDS.filter(([k]) => list.includes(k)).map(([k]) => k).join(',');

export const matchesTrend = (g: { trend_badge?: string | null }, selected: TrendKey[]) =>
  !selected.length || (!!g.trend_badge && selected.some((k) => BADGES_OF[k].includes(g.trend_badge!)));

// 이 필터가 켜졌을 때의 기본 정렬 — 판정 점수 높은 순 (점수가 같으면 인기순)
export const byTrendScore = (a: { trend_score?: number | null; heat_rank?: number | null }, b: { trend_score?: number | null; heat_rank?: number | null }) =>
  (b.trend_score ?? -Infinity) - (a.trend_score ?? -Infinity) || (a.heat_rank ?? Infinity) - (b.heat_rank ?? Infinity);
