import test from 'node:test';
import assert from 'node:assert/strict';
import { buildReviewRows } from './review-snapshot.mjs';

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
