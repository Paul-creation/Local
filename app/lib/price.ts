export function getPriceInfo(game: any) {
  const entry = game.price_history?.[0];
  if (!entry) return null;

  const final = entry.price;
  const discount = entry.discount_percent || 0;
  const original = discount > 0 ? Math.round(final / (1 - discount / 100)) : final;

  return {
    final,
    original,
    discount,
    formattedFinal: `₩${final.toLocaleString('ko-KR')}`,
    formattedOriginal: `₩${original.toLocaleString('ko-KR')}`,
  };
}