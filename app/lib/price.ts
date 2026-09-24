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