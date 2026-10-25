// scripts/lib/review-snapshot.mjs
// games의 리뷰 수·긍정률을 날짜별 기록(review_history) 행으로 바꾸는 순수 함수 — snapshot-review-history.mjs와 테스트가 쓴다
// 리뷰 수를 모르는 게임(review_total null)은 기록하지 않는다. 긍정률은 모르면 null로 둔다
// withSource: review_history.source 칸이 있을 때만 출처(games.review_source)를 함께 기록 (없으면 null)
export function buildReviewRows(games, date, { withSource = false } = {}) {
  return games
    .filter((g) => g.review_total != null)
    .map((g) => ({
      snapshot_date: date, game_id: g.id, review_total: g.review_total, review_positive_percent: g.review_positive_percent ?? null,
      ...(withSource ? { source: g.review_source ?? null } : {}),
    }));
}

// 한 게임의 날짜순 기록 → 하루 단위 리뷰 증가량. 리뷰 증가량을 쓰는 코드는 이 함수를 거친다
// 출처(appreviews·getitems·상점 페이지)가 바뀐 날 전후는 개수 기준이 달라 차이가 가짜 증가·감소가 되므로 뺀다
// (출처 null끼리는 칸이 생기기 전 기록이라 같은 출처로 봄 — null과 값이 있는 쪽은 다른 출처). 연속한 날짜가 아니어도 그 사이 일수로 나누지 않고 그대로 돌려줌
export function reviewDeltas(history) {
  const out = [];
  for (let i = 1; i < history.length; i++) {
    const a = history[i - 1], b = history[i];
    if (a.review_total == null || b.review_total == null) continue;
    if ((a.source ?? null) !== (b.source ?? null)) continue;
    out.push({ from: a.snapshot_date, to: b.snapshot_date, delta: b.review_total - a.review_total });
  }
  return out;
}
