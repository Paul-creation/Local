// scripts/lib/review-snapshot.mjs
// games의 리뷰 수·긍정률을 날짜별 기록(review_history) 행으로 바꾸는 순수 함수 — snapshot-review-history.mjs와 테스트가 쓴다
// 리뷰 수를 모르는 게임(review_total null)은 기록하지 않는다. 긍정률은 모르면 null로 둔다
export function buildReviewRows(games, date) {
  return games
    .filter((g) => g.review_total != null)
    .map((g) => ({ snapshot_date: date, game_id: g.id, review_total: g.review_total, review_positive_percent: g.review_positive_percent ?? null }));
}
