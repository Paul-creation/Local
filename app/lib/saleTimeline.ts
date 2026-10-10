// 이번 주 할인 마감 타임라인 규칙 (서버·브라우저 어디서나 쓰는 순수 함수, KST)
// 보여주는 것: 할인 중(discount > 0)이고 종료 시각이 지금 이후 ~ 168시간 이내인 게임. 종료일을 모르면(null) 올리지 않는다
const HOUR = 3600_000;
const DAY = 24 * HOUR;
const KST = 9 * HOUR;
const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토'];

export const WINDOW_MS = 7 * DAY; // 168시간

export type TimelineItem = { id: string; endsAt: string; discount: number; [k: string]: unknown };

const kstDay = (t: number) => Math.floor((t + KST) / DAY);

export function endsWithinWindow(discount: number | null | undefined, endsAt: string | null | undefined, now: number): boolean {
  if (!(Number(discount) > 0) || !endsAt) return false;
  const t = new Date(endsAt).getTime();
  return Number.isFinite(t) && t > now && t - now <= WINDOW_MS;
}

export type TimelineGroup<T> = { dayKey: number; heading: string; today: boolean; items: T[] };

// 마감 시각 순으로 KST 날짜별로 묶는다. 이미 끝난 것·168시간 밖은 빠지고, 비는 날짜는 만들지 않는다
export function groupByDay<T extends { endsAt: string; discount: number }>(items: T[], now: number): TimelineGroup<T>[] {
  const live = items
    .filter((i) => endsWithinWindow(i.discount, i.endsAt, now))
    .sort((a, b) => new Date(a.endsAt).getTime() - new Date(b.endsAt).getTime());
  const groups: TimelineGroup<T>[] = [];
  for (const item of live) {
    const t = new Date(item.endsAt).getTime();
    const key = kstDay(t);
    let g = groups[groups.length - 1];
    if (!g || g.dayKey !== key) {
      const d = new Date(t + KST);
      const date = `${d.getUTCMonth() + 1}/${d.getUTCDate()}(${WEEKDAY[d.getUTCDay()]})`;
      const diff = key - kstDay(now);
      const prefix = diff === 0 ? '오늘 · ' : diff === 1 ? '내일 · ' : '';
      g = { dayKey: key, heading: prefix + date, today: diff === 0, items: [] };
      groups.push(g);
    }
    g.items.push(item);
  }
  return groups;
}

// 카드 오른쪽 시각 "02:00까지" (날짜는 마디 제목이 보여 준다)
export function endTimeText(endsAt: string): string {
  const d = new Date(new Date(endsAt).getTime() + KST);
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}까지`;
}
