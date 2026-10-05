// 구매 타이밍 한 줄 — price_history로 계산한 사실만 (미래 예측 문구는 쓰지 않음)
// 할인 1번 = 할인 중인 기록이 이어진 구간 하나. 할인 구간이 3번 미만이면 아무것도 보여 주지 않음
// 우선순위: 역대 최저가와 같은 가격 → 지난 1년(또는 기록 기간) 중 가장 큰 할인 → 평균 N일마다 할인
type Row = { price: number; discount_percent: number | null; checked_at: string };

const DAY = 86400000;

// 가격 카드에만 보여주는 문구 — 할인 전적 섹션에서는 중복이라 숨긴다
export const SAME_AS_LOWEST = '역대 최저가와 같은 가격이에요';

export function buyTimingLine(history: Row[], opts: { currentPrice: number | null; currentDiscount: number; lowestPrice: number | null; now: number }) {
  const rows = history
    .filter((r) => r.price >= 100 && r.checked_at)
    .map((r) => ({ t: new Date(r.checked_at).getTime(), price: r.price, off: r.discount_percent || 0 }))
    .sort((a, b) => a.t - b.t);
  if (rows.length < 2) return null;

  // 할인 구간 나누기 (할인 → 정가 → 할인이면 두 번)
  const sales: { start: number; maxOff: number }[] = [];
  let inSale = false;
  for (const r of rows) {
    if (r.off > 0 && !inSale) sales.push({ start: r.t, maxOff: r.off });
    else if (r.off > 0) sales[sales.length - 1].maxOff = Math.max(sales[sales.length - 1].maxOff, r.off);
    inSale = r.off > 0;
  }
  if (sales.length < 3) return null;

  const yearAgo = opts.now - 365 * DAY;
  const fullYear = rows[0].t <= yearAgo;
  const months = Math.max(1, Math.round((opts.now - rows[0].t) / (30 * DAY)));
  const period = fullYear ? '지난 1년' : `최근 ${months}개월`;
  const recent = sales.filter((s) => s.start >= yearAgo);

  const { currentPrice, currentDiscount, lowestPrice } = opts;
  if (currentDiscount > 0 && currentPrice != null && lowestPrice != null && Math.round(currentPrice) <= Math.round(lowestPrice)) {
    return SAME_AS_LOWEST;
  }
  // 지금 할인 구간은 빼고 비교 (자기 자신과 비교하지 않게)
  const past = (inSale ? recent.slice(0, -1) : recent);
  if (currentDiscount > 0 && past.length >= 2 && currentDiscount >= Math.max(...past.map((s) => s.maxOff))) {
    return `${period} 중 가장 큰 할인이에요`;
  }
  if (recent.length >= 3) {
    const gaps = recent.slice(1).map((s, i) => (s.start - recent[i].start) / DAY);
    const avg = Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length);
    if (avg >= 1) return `${period}간 평균 ${avg}일마다 할인했어요`;
  }
  return null;
}
