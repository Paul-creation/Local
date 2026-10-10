// 할인 종료 시각 표시 규칙 (KST) — price_history.sale_ends_at을 그대로 보여 주고, 추정하지 않는다
// null·잘못된 값·이미 지난 시각이면 null (아무것도 표시하지 않음)
const HOUR = 3600_000;
const DAY = 24 * HOUR;
const KST = 9 * HOUR;
const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토'];

const pad = (n: number) => String(n).padStart(2, '0');
const kst = (t: number) => new Date(t + KST); // getUTC*로 읽으면 KST 시각
const kstDay = (t: number) => Math.floor((t + KST) / DAY);

function endOf(iso: string | null | undefined, now: number): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) && t > now ? t : null;
}

// 카드·목록용 한 줄. 24시간 안이면 "오늘 02:00까지"/"내일 02:00까지"(soon), 아니면 "10/14 02:00까지"
export function saleEndsLabel(iso: string | null | undefined, now: number): { text: string; soon: boolean } | null {
  const t = endOf(iso, now);
  if (t == null) return null;
  const d = kst(t);
  const hm = `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
  if (t - now <= DAY) {
    const day = kstDay(t) === kstDay(now) ? '오늘' : '내일';
    return { text: `${day} ${hm}까지`, soon: true };
  }
  return { text: `${d.getUTCMonth() + 1}/${d.getUTCDate()} ${hm}까지`, soon: false };
}

// 좁은 화면 행용 짧은 형식. 24시간 안이면 위 한 줄과 같은 문구(soon), 아니면 "~10/13"
export function saleEndsShort(iso: string | null | undefined, now: number): { text: string; soon: boolean } | null {
  const t = endOf(iso, now);
  if (t == null) return null;
  if (t - now <= DAY) return saleEndsLabel(iso, now);
  const d = kst(t);
  return { text: `~${d.getUTCMonth() + 1}/${d.getUTCDate()}`, soon: false };
}

// 상세 가격 박스용: "할인 종료 10/14(화) 02:00"
export function saleEndsDetail(iso: string | null | undefined, now: number): { text: string; soon: boolean } | null {
  const t = endOf(iso, now);
  if (t == null) return null;
  const d = kst(t);
  return {
    text: `할인 종료 ${d.getUTCMonth() + 1}/${d.getUTCDate()}(${WEEKDAY[d.getUTCDay()]}) ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`,
    soon: t - now <= DAY,
  };
}

// 역대 최저가 게이지: 정가 0% → 역대 최저가 100%. 숫자 하나라도 없거나 앞뒤가 안 맞으면 null (게이지 숨김, 추정하지 않음)
export function lowestGauge(regular: number | null | undefined, current: number | null | undefined, lowest: number | null | undefined) {
  if (regular == null || current == null || lowest == null) return null;
  if (!(regular >= 100) || !(current >= 100) || !(lowest >= 100)) return null;
  if (lowest >= regular) return null; // 역대 최저가가 정가 이상
  if (current < lowest) return null;  // 현재가가 역대 최저가보다 낮음
  if (current > regular) return null; // 정가보다 비쌈
  const atLowest = Math.round(current) <= Math.round(lowest);
  return {
    percent: atLowest ? 100 : Math.max(0, Math.min(100, ((regular - current) / (regular - lowest)) * 100)),
    remaining: atLowest ? 0 : Math.round(current - lowest),
    atLowest,
  };
}
