// 상세 태그 칩이 누르면 이동할 목록 주소 — 메인 검색 결과(?r=1)에 태그 필터를 담는다 (useGameFilters가 tags를 읽음).
// 태그 나무 칸은 번호, 협동·대전은 이름(FLAG_TAGS), '혼자 플레이'는 분류(cat). 특별 칩(TOP 10·올해의 게임)은 태그가 아니라 링크 없음
const PLAY_TAGS = new Set(['협동', '온라인 협동', '로컬 협동', '대전']);

export function chipHref(c: { text: string; kind: string; tagId?: number }): string | null {
  if (c.tagId != null) return `/?r=1&tags=${c.tagId}`;
  if (c.kind === 'play') {
    if (PLAY_TAGS.has(c.text)) return `/?r=1&tags=${encodeURIComponent(c.text)}`;
    if (c.text === '혼자 플레이') return `/?r=1&cat=${encodeURIComponent('혼자')}`;
  }
  return null;
}
