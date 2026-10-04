export function getPriceInfo(game: any) {
  // 메인 목록은 flattenGame으로 펴서 보낸 price_final·price_discount를 그대로 쓴다
  if (game.price_final != null) return makePriceInfo(game.price_final, game.price_discount || 0);
  const history = game.price_history;
  if (!history || history.length === 0) return null;

  // KRW만 사용, 100 미만은 달러로 판단해서 제외
  const krwEntries = history.filter((p: any) => p.price >= 100);
  if (krwEntries.length === 0) return null;

  // 가장 최근 기록 사용
  const entry = krwEntries.sort((a: any, b: any) =>
    new Date(b.checked_at).getTime() - new Date(a.checked_at).getTime()
  )[0];

  return makePriceInfo(entry.price, entry.discount_percent || 0);
}

function makePriceInfo(final: number, discount: number) {
  const original = discount > 0 ? Math.round(final / (1 - discount / 100)) : final;

  return {
    final,
    original,
    discount,
    formattedFinal: `₩${Math.round(final).toLocaleString('ko-KR')}`,
    formattedOriginal: `₩${Math.round(original).toLocaleString('ko-KR')}`,
  };
}

// 메인으로 보내는 게임 데이터 줄이기: price_history 배열을 최신 가격 두 칸(price_final·price_discount)으로 펴고,
// 값이 없는 칸(null)은 빼서 보낸다. 화면 코드는 null과 없는 칸을 똑같이 다룬다 (false·0은 그대로 둠)
export function flattenGame<T extends Record<string, any>>(game: T) {
  const price = getPriceInfo(game);
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(game)) if (k !== 'price_history' && v != null) out[k] = v;
  if (price) {
    out.price_final = price.final;
    if (price.discount) out.price_discount = price.discount;
  }
  return out;
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

