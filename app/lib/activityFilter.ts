// 필터의 "가능한 활동" 판정·게임 수 세기 (import 없는 순수 함수 — 테스트가 직접 불러옴. 주소·자동완성은 activitySearch.ts, 분류표는 activities.ts)
// 판정: 고른 활동을 모두 가진 게임(AND). 기본은 확정(activities_confirmed)만, "확인 중 포함"을 켜면 activities_unsure도 같은 활동으로 본다

type ActGame = { activities_confirmed?: string[] | null; activities_unsure?: string[] | null };

export const hasActivity = (g: ActGame, key: string, includeUnsure: boolean) =>
  !!g.activities_confirmed?.includes(key) || (includeUnsure && !!g.activities_unsure?.includes(key));

export const matchesActivities = (g: ActGame, keys: string[], includeUnsure: boolean) =>
  keys.every((k) => hasActivity(g, k, includeUnsure));

// 활동 키마다 그 활동이 있는 게임 수 (전체 목록 기준)
export function countActivities(games: ActGame[], includeUnsure: boolean) {
  const counts = new Map<string, number>();
  for (const g of games) {
    for (const k of new Set([...(g.activities_confirmed || []), ...(includeUnsure ? g.activities_unsure || [] : [])])) {
      counts.set(k, (counts.get(k) || 0) + 1);
    }
  }
  return counts;
}
