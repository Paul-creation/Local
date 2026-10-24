// 실행: npm test — 상점 페이지 전체 평가 줄 읽기 (appreviews 대체 경로)
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseAllReviews, fetchStoreReviews } from './review-store.mjs';
import { buildReviewUpdate } from './review-fill.mjs';

const row = (subtitle, tip, label) => `<div id="userReviews" class="user_reviews">
  <a class="user_reviews_summary_row" href="#app_reviews_hash" data-tooltip-html="${tip}">
    <div class="subtitle column all">
					${subtitle}				</div>
    <div class="summary column"><span class="game_review_summary positive">${label}</span></div></a></div><div class="game_area_purchase"></div>`;
const ALL = row('All Reviews:', '74% of the 742 user reviews for this game are positive.', 'Mostly Positive');
const LANG = row('English Reviews:', '85% of the 2,638,603 user reviews in your language are positive', 'Very Positive');

test('All Reviews 줄: 개수·퍼센트·문구', () => {
  assert.deepEqual(parseAllReviews(ALL), { total_reviews: 742, positive_percent: 74, review_score_desc: 'Mostly Positive' });
});

test('언어별 줄만 있으면(리뷰 많은 게임) null — 전체 값과 달라서 쓰지 않음', () => {
  assert.equal(parseAllReviews(LANG), null);
});

test('쉼표가 든 개수', () => {
  assert.equal(parseAllReviews(row('All Reviews:', '96% of the 1,348 user reviews for this game are positive.', 'Very Positive')).total_reviews, 1348);
});

test('조회 실패·상점 페이지가 아님·줄 없음은 null', async () => {
  assert.equal(await fetchStoreReviews('1', { get: async () => { throw new Error('막힘'); } }), null);
  assert.equal(await fetchStoreReviews('1', { get: async () => '<html>store main</html>' }), null);
  assert.equal(await fetchStoreReviews('1', { get: async () => LANG }), null);
  assert.equal((await fetchStoreReviews('1', { get: async () => ALL })).total_reviews, 742);
});

test('상점 값으로 games 업데이트: 퍼센트는 그대로, 문구는 한국어', () => {
  assert.deepEqual(buildReviewUpdate({ review_summary: null }, parseAllReviews(ALL)), { review_total: 742, review_positive_percent: 74, review_summary: '대체로 긍정적' });
});
