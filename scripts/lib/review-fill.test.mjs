// 실행: npm test — 리뷰 칸 채우기 규칙
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildReviewUpdate } from './review-fill.mjs';

const qs = { total_reviews: 200, total_positive: 190, review_score_desc: 'Overwhelmingly Positive' };

test('리뷰 칸이 모두 빈 게임: 3칸 다 채움', () => {
  assert.deepEqual(buildReviewUpdate({ review_summary: null }, qs), { review_total: 200, review_positive_percent: 95, review_summary: '압도적으로 긍정적' });
});

test('이미 문구가 있는 게임: 수·긍정률만 갱신, 문구는 그대로', () => {
  assert.deepEqual(buildReviewUpdate({ review_summary: '매우 긍정적' }, qs), { review_total: 200, review_positive_percent: 95 });
});

test('조회 실패(null·형식 이상): 아무것도 안 바꿈', () => {
  assert.deepEqual(buildReviewUpdate({ review_summary: null }, null), {});
  assert.deepEqual(buildReviewUpdate({ review_summary: null }, {}), {});
});

test('리뷰 0개: 0%·0개, 모르는 문구는 비워 둠', () => {
  assert.deepEqual(buildReviewUpdate({ review_summary: null }, { total_reviews: 0, total_positive: 0, review_score_desc: 'Unknown' }), { review_total: 0, review_positive_percent: 0 });
});
