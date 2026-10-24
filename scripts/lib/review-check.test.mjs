// 실행: npm test — 일일 요약의 리뷰 조회 실패 줄
import test from 'node:test';
import assert from 'node:assert/strict';
import { reviewCheckLine } from './review-check.mjs';

test('기록이 없으면 안 돌았다고 알림', () => {
  assert.match(reviewCheckLine(null), /오늘 기록 없음/);
});

test('실패 0개: 경고 없이 숫자만', () => {
  assert.equal(reviewCheckLine({ checked: 1508, failed: 0 }), '⭐ 리뷰 조회 실패: 0/1508개');
});

test('실패가 있으면 경고 표시', () => {
  assert.match(reviewCheckLine({ checked: 1508, failed: 1508 }), /1508\/1508개 ⚠️/);
});
