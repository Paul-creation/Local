// 담당: 친구(검색·태그·비교)
// 고른 태그 판정 — 기본은 전부 가진 게임(AND), matchAny면 하나라도 가진 게임(OR, 이벤트 링크의 ?match=any)
export function matchesTags(keys: string[], has: (key: string) => boolean, matchAny = false) {
  if (!keys.length) return true;
  return matchAny ? keys.some(has) : keys.every(has);
}
