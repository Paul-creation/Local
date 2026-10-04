// 날짜 표시 공통 — 서버(UTC)·브라우저 시간대와 상관없이 항상 한국 시간 기준으로 같은 글자
// - 날짜만 있는 값("2024-12-10")은 달력 날짜 그대로 (시간대 변환 안 함)
// - 시각이 있는 값("2026-10-02T13:18:07+00:00", "2026-09-26 06:55:12+00")은 한국 시간으로 바꿔서
type DateInput = string | number | Date | null | undefined;
type Parts = { y: number; m: number; d: number; hh: number; mm: number };

const KST_OFFSET = 9 * 60 * 60 * 1000;
const pad = (n: number) => String(n).padStart(2, '0');

function toParts(v: DateInput): Parts | null {
  if (v == null || v === '') return null;
  if (typeof v === 'string') {
    const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v.trim());
    if (dateOnly) return { y: +dateOnly[1], m: +dateOnly[2], d: +dateOnly[3], hh: 0, mm: 0 };
    // Postgres 표기("2026-09-26 06:55:12.86+00")도 읽히게 ISO 형태로 맞춤
    v = v.trim().replace(' ', 'T').replace(/([+-]\d{2})$/, '$1:00');
  }
  const t = new Date(v).getTime();
  if (Number.isNaN(t)) return null;
  const k = new Date(t + KST_OFFSET);
  return { y: k.getUTCFullYear(), m: k.getUTCMonth() + 1, d: k.getUTCDate(), hh: k.getUTCHours(), mm: k.getUTCMinutes() };
}

/** "2026.10.02" */
export function formatDate(v: DateInput): string {
  const p = toParts(v);
  return p ? `${p.y}.${pad(p.m)}.${pad(p.d)}` : '';
}

/** "2026.10" */
export function formatYearMonth(v: DateInput): string {
  const p = toParts(v);
  return p ? `${p.y}.${pad(p.m)}` : '';
}

/** "10.02" — 차트 눈금처럼 좁은 곳 */
export function formatMonthDay(v: DateInput): string {
  const p = toParts(v);
  return p ? `${pad(p.m)}.${pad(p.d)}` : '';
}

/** "2026.10.02 22:18" — 관리자 화면처럼 시각까지 필요한 곳 */
export function formatDateTime(v: DateInput): string {
  const p = toParts(v);
  return p ? `${p.y}.${pad(p.m)}.${pad(p.d)} ${pad(p.hh)}:${pad(p.mm)}` : '';
}
