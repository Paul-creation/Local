import test from 'node:test';
import assert from 'node:assert/strict';
import { buildReviewRows, reviewDeltas } from './review-snapshot.mjs';

test('리뷰 수를 아는 게임만 날짜와 함께 행으로', () => {
  const rows = buildReviewRows([
    { id: 'a', review_total: 120, review_positive_percent: 91 },
    { id: 'b', review_total: null, review_positive_percent: 80 },
    { id: 'c', review_total: 0, review_positive_percent: null },
  ], '2026-10-24');
  assert.deepEqual(rows, [
    { snapshot_date: '2026-10-24', game_id: 'a', review_total: 120, review_positive_percent: 91 },
    { snapshot_date: '2026-10-24', game_id: 'c', review_total: 0, review_positive_percent: null },
  ]);
});

test('게임이 없으면 빈 배열', () => {
  assert.deepEqual(buildReviewRows([], '2026-10-24'), []);
});

test('출처 칸이 있으면 함께 기록', () => {
  assert.deepEqual(buildReviewRows([{ id: 'a', review_total: 5, review_positive_percent: 90, review_source: 'getitems' }], '2026-10-25', { withSource: true }), [
    { snapshot_date: '2026-10-25', game_id: 'a', review_total: 5, review_positive_percent: 90, source: 'getitems' },
  ]);
});

test('증가량: 출처가 바뀐 날 전후는 뺌', () => {
  const h = [
    { snapshot_date: '10-23', review_total: 1000, source: 'appreviews' },
    { snapshot_date: '10-24', review_total: 1010, source: 'appreviews' },
    { snapshot_date: '10-25', review_total: 800, source: 'getitems' },
    { snapshot_date: '10-26', review_total: 812, source: 'getitems' },
  ];
  assert.deepEqual(reviewDeltas(h), [
    { from: '10-23', to: '10-24', delta: 10 },
    { from: '10-25', to: '10-26', delta: 12 },
  ]);
});

test('증가량: 출처 null끼리는 같은 출처, null과 값은 다른 출처, 리뷰 수 없는 날은 뺌', () => {
  assert.deepEqual(reviewDeltas([
    { snapshot_date: 'a', review_total: 1, source: null },
    { snapshot_date: 'b', review_total: 3 },
    { snapshot_date: 'c', review_total: 4, source: 'getitems' },
    { snapshot_date: 'd', review_total: null, source: 'getitems' },
  ]), [{ from: 'a', to: 'b', delta: 2 }]);
});
