// scripts/lib/review-fill.mjs
// appreviews의 query_summary를 games 업데이트 값으로 바꾸는 순수 함수 — enrich-players.mjs와 테스트가 쓴다
// review_total·review_positive_percent는 매번 최신 값으로 갱신, review_summary(평가 문구)는 비어 있을 때만 채움 (이미 있는 값은 건드리지 않음)
export const REVIEW_LABELS = {
  'Overwhelmingly Positive': '압도적으로 긍정적', 'Very Positive': '매우 긍정적',
  'Positive': '긍정적', 'Mostly Positive': '대체로 긍정적', 'Mixed': '복합적',
  'Mostly Negative': '대체로 부정적', 'Negative': '부정적',
  'Very Negative': '매우 부정적', 'Overwhelmingly Negative': '압도적으로 부정적',
  'No user reviews': '리뷰 없음',
};

// qs가 없으면(조회 실패) 빈 객체 — 건너뜀
export function buildReviewUpdate(game, qs) {
  if (!qs || typeof qs.total_reviews !== 'number') return {};
  // 상점 페이지에서 읽은 값은 긍정 개수 없이 퍼센트만 있음(positive_percent)
  const update = {
    review_total: qs.total_reviews,
    review_positive_percent: qs.positive_percent ?? (qs.total_reviews > 0 ? Math.round((qs.total_positive / qs.total_reviews) * 100) : 0),
  };
  const label = REVIEW_LABELS[qs.review_score_desc];
  if (game.review_summary == null && label) update.review_summary = label;
  return update;
}
