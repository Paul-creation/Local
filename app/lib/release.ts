// 출시 예정(coming soon)·데모 게임 표시 규칙 — 순수 함수라 release.test.mjs가 .ts를 바로 불러온다 (다른 파일을 import하지 않는다)
// games.release_status('released' | 'coming_soon')·demo_appid·release_date_text. 목록(gameIndex)에는 출시 예정 게임에만 세 칸이 실린다
export type ReleaseGame = { release_status?: string | null; demo_appid?: string | null; release_date_text?: string | null };

export const isComingSoon = (g: ReleaseGame) => g.release_status === 'coming_soon';

// 데모는 출시 예정 게임에서만 보여준다 (출시된 뒤에는 데모가 내려가는 일이 많아서)
export const hasDemo = (g: ReleaseGame) => isComingSoon(g) && !!g.demo_appid;

// 출시일 원문에 숫자(연도·월·분기)가 있어야 날짜로 친다 — "출시 예정"·"발표 예정"·"Coming soon"·"To be announced" 같은 문구는 날짜가 아니다
export const hasReleaseDate = (g: ReleaseGame) => /\d/.test(g.release_date_text ?? '');

// 가격 자리 문구: "출시 예정 · 2026년 4분기" / 날짜가 없으면 "출시 예정 · 날짜 미정"
export function comingSoonLabel(g: ReleaseGame): string {
  return hasReleaseDate(g) ? `출시 예정 · ${(g.release_date_text ?? '').trim()}` : '출시 예정 · 날짜 미정';
}

// 데모 상점 페이지 (새 탭으로 연다)
export const demoStoreUrl = (demoAppid: string) => `https://store.steampowered.com/app/${demoAppid}`;
