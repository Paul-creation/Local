// 메인 추천 카드(인원별·찜 기반)에 덧붙는 정보의 순수 규칙 — 다른 파일을 import하지 않아 테스트(cardInfo.test.mjs)가 .ts를 바로 불러온다

// 카드에 덧붙는 칸 — 평가·태그·한국어 지원은 게임 목록(gameIndex)에 없어 따로 읽는다 (lib/cardExtras)
export type CardExtras = {
  top_tags: string[];            // 한국어 태그 앞 2개 (지금 뜨는 게임 4~10위 줄과 같은 기준)
  review_percent: number | null; // 스팀 긍정 %
  review_summary: string | null; // 평가 문구 — 화면에는 안 쓰고 색 단계(긍정·부정)만 정한다
  review_total: number | null;
  no_korean: boolean;            // 한국어 지원 칸이 "한국어 없음"일 때만 참 (모르면 거짓 = 칩 없음)
};

export const TAG_LIMIT = 2;

const BARRIERS = ['낮음', '보통', '높음'];
const DIFFICULTY_TO_BARRIER: Record<string, string> = { 쉬움: '낮음', 보통: '보통', 어려움: '높음' };

// 진입장벽 — entry_barrier가 있으면 그대로, 없으면 difficulty(쉬움·보통·어려움)를 같은 말(낮음·보통·높음)로 바꿔 쓴다. 둘 다 없으면 null = 그 줄 숨김
export function barrierLabel(g: { entry_barrier?: string | null; difficulty?: string | null }): string | null {
  if (g.entry_barrier && BARRIERS.includes(g.entry_barrier)) return g.entry_barrier;
  return (g.difficulty && DIFFICULTY_TO_BARRIER[g.difficulty]) || null;
}

export const isNoKorean = (koreanSupport: string | null | undefined) => koreanSupport === '한국어 없음';

// 칩 줄 — 태그(최대 2) → 크로스플레이(지원할 때만) → 한국어 미지원(없을 때만). kind로 색을 정한다 (태그는 중립, up = 초록, down = 빨강)
export type InfoChip = { text: string; kind: 'tag' | 'up' | 'down' };
export function infoChips(g: { top_tags?: string[] | null; has_crossplay?: boolean | null; no_korean?: boolean | null }): InfoChip[] {
  return [
    ...(g.top_tags || []).slice(0, TAG_LIMIT).map((text) => ({ text, kind: 'tag' as const })),
    ...(g.has_crossplay === true ? [{ text: '크로스플레이', kind: 'up' as const }] : []),
    ...(g.no_korean === true ? [{ text: '한국어 미지원', kind: 'down' as const }] : []),
  ];
}
