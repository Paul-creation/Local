// 출시 예정(coming soon)·데모 게임 표시 규칙 — 순수 함수라 release.test.mjs가 .ts를 바로 불러온다 (다른 파일을 import하지 않는다)
// games.release_status('released' | 'coming_soon')·demo_appid·release_date_text. 목록(gameIndex)에는 출시 예정 게임에만 세 칸이 실린다
export type ReleaseGame = { release_status?: string | null; demo_appid?: string | null; release_date_text?: string | null };

export const isComingSoon = (g: ReleaseGame) => g.release_status === 'coming_soon';

// 데모는 출시 예정 게임에서만 보여준다 (출시된 뒤에는 데모가 내려가는 일이 많아서)
export const hasDemo = (g: ReleaseGame) => isComingSoon(g) && !!g.demo_appid;

// 스팀이 날짜 대신 주는 말("출시 예정", "Coming soon")이면 문구가 겹치므로 날짜로 치지 않는다
const PLACEHOLDER = /^(출시\s*예정|coming\s*soon|to\s*be\s*announced|tba)$/i;

// 가격 자리 문구: "출시 예정 · 2026년 11월" / 날짜를 모르면 "출시 예정"
export function comingSoonLabel(g: ReleaseGame): string {
  const text = (g.release_date_text ?? '').trim();
  return text && !PLACEHOLDER.test(text) ? `출시 예정 · ${text}` : '출시 예정';
}

// 데모 상점 페이지 (새 탭으로 연다)
export const demoStoreUrl = (demoAppid: string) => `https://store.steampowered.com/app/${demoAppid}`;
