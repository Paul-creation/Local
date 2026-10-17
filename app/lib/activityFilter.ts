// 필터의 "가능한 활동" 판정·게임 수 세기 (import 없는 순수 함수 — 테스트가 직접 불러옴. 주소·자동완성은 activitySearch.ts, 분류표는 activities.ts)
// 판정: 고른 활동을 모두 가진 게임(AND). 기본은 확정(activities_confirmed)만, "확인 중 포함"을 켜면 activities_unsure도 같은 활동으로 본다

type ActGame = { activities_confirmed?: string[] | null; activities_unsure?: string[] | null };

// alsoHas: 같은 뜻의 스팀 태그가 있으면 있는 것으로 보는 추가 판정 (ACTIVITY_TAG_MAP — 활동 OR 태그)
type AlsoHas<G> = ((g: G, key: string) => boolean) | undefined;

export const hasActivity = <G extends ActGame>(g: G, key: string, includeUnsure: boolean, alsoHas?: AlsoHas<G>) =>
  !!g.activities_confirmed?.includes(key) || (includeUnsure && !!g.activities_unsure?.includes(key)) || !!alsoHas?.(g, key);

export const matchesActivities = <G extends ActGame>(g: G, keys: string[], includeUnsure: boolean, alsoHas?: AlsoHas<G>) =>
  keys.every((k) => hasActivity(g, k, includeUnsure, alsoHas));

// 활동 키마다 그 활동이 있는 게임 수 (전체 목록 기준). keys: 센 대상 키(같은 뜻의 태그만 있는 활동도 세려면 분류표 전체를 넘긴다)
export function countActivities<G extends ActGame>(games: G[], includeUnsure: boolean, keys: readonly string[], alsoHas?: AlsoHas<G>) {
  const counts = new Map<string, number>();
  for (const k of keys) {
    let n = 0;
    for (const g of games) if (hasActivity(g, k, includeUnsure, alsoHas)) n++;
    if (n) counts.set(k, n);
  }
  return counts;
}
