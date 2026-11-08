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

// 출시일 원문이 "2026년 11월 26일"처럼 날짜까지 있어야 D-N을 센다 — "2027년 1월"·"2026년 4분기"는 대략이라 세지 않는다 (release_date 칸은 이런 경우 1일로 채워져 믿을 수 없음)
const FULL_DATE = /(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일/;
const kstToday = (now: Date) => {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Seoul', year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(now).map((x) => [x.type, x.value]));
  return Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day));
};

// 출시까지 남은 날(한국 날짜 기준). 날짜가 정확하지 않거나 이미 지났으면 null
export function daysUntilRelease(g: ReleaseGame, now: Date = new Date()): number | null {
  const m = FULL_DATE.exec(g.release_date_text ?? '');
  if (!m) return null;
  const days = Math.round((Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) - kstToday(now)) / 864e5);
  return days >= 0 ? days : null;
}

// 출시 예정 전용 타일 값: "D-12" / 출시 당일 "D-DAY" / 날짜가 대략이면 원문 / 없으면 "날짜 미정"
export function releaseTile(g: ReleaseGame, now: Date = new Date()): { label: string; value: string; exact: boolean } {
  const d = daysUntilRelease(g, now);
  if (d != null) return { label: '출시까지', value: d === 0 ? 'D-DAY' : `D-${d}`, exact: true };
  return { label: '출시일', value: hasReleaseDate(g) ? (g.release_date_text ?? '').trim() : '날짜 미정', exact: false };
}
