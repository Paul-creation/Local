// 필터·검색창의 "가능한 활동" — 묶음별 목록, 주소(?act=drive,train) 변환, 검색창 자동완성 (판정·개수는 activityFilter.ts, 분류표는 activities.ts)
import { ACTIVITIES, ACTIVITY_GROUPS, isActivityKey, type ActivityKey } from './activities';
import { normalizeSearch } from './searchMatch';

// 필터 패널용 묶음별 목록 (ACTIVITY_GROUPS 순서, 활동 정의 순서 유지)
export const ACTIVITY_BY_GROUP = ACTIVITY_GROUPS.map((group) => ({ group, items: ACTIVITIES.filter((a) => a.group === group) }));

// ?act=drive,train → 알려진 키만, 중복 없이
export const parseActivities = (v: string | null): ActivityKey[] =>
  [...new Set((v || '').split(',').filter(isActivityKey))];

// 검색창 자동완성 — 마지막으로 친 단어가 활동 라벨과 맞으면(시작 우선, 그다음 포함) 후보
export function suggestActivities(word: string, exclude: string[], limit: number): ActivityKey[] {
  const q = normalizeSearch(word);
  if (!q) return [];
  const ranked: [ActivityKey, number][] = [];
  for (const a of ACTIVITIES) {
    if (exclude.includes(a.key)) continue;
    const label = normalizeSearch(a.label);
    const r = label.startsWith(q) ? 0 : label.includes(q) ? 1 : -1;
    if (r >= 0) ranked.push([a.key, r * 100 + label.length]);
  }
  return ranked.sort((a, b) => a[1] - b[1]).slice(0, limit).map(([k]) => k);
}
