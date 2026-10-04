export function getPriceInfo(game: any) {
  const history = game.price_history;
  if (!history || history.length === 0) return null;

  // KRW만 사용, 100 미만은 달러로 판단해서 제외
  const krwEntries = history.filter((p: any) => p.price >= 100);
  if (krwEntries.length === 0) return null;

  // 가장 최근 기록 사용
  const entry = krwEntries.sort((a: any, b: any) =>
    new Date(b.checked_at).getTime() - new Date(a.checked_at).getTime()
  )[0];

  const final = entry.price;
  const discount = entry.discount_percent || 0;
  const original = discount > 0 ? Math.round(final / (1 - discount / 100)) : final;

  return {
    final,
    original,
    discount,
    formattedFinal: `₩${Math.round(final).toLocaleString('ko-KR')}`,
    formattedOriginal: `₩${Math.round(original).toLocaleString('ko-KR')}`,
  };
}
// 역대 최저가 배지 기준 (games.lowest_price 기준) — 할인 중일 때만
// best: 현재 가격 ≤ 역대 최저가, near: 역대 최저가보다 10% 이내로 비쌈
// 100원 미만은 달러로 잘못 들어온 값이라 제외 (getPriceInfo와 같은 기준)
export type LowestTiming = 'best' | 'near' | null;

export function getLowestTiming(game: { is_free?: boolean | null; lowest_price?: number | null }, price: { final: number; discount: number } | null): LowestTiming {
  if (game.is_free || !price || price.discount <= 0) return null;
  const lowest = game.lowest_price;
  if (!lowest || lowest < 100 || price.final < 100) return null;
  if (price.final <= lowest) return 'best';
  if (price.final <= lowest * 1.1) return 'near';
  return null;
}

