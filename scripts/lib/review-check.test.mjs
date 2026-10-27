// 실행: npm test — 일일 요약의 리뷰 조회 실패 줄
import test from 'node:test';
import assert from 'node:assert/strict';
import { reviewCheckLine } from './review-check.mjs';

test('기록이 없으면 안 돌았다고 알림', () => {
  assert.match(reviewCheckLine(null), /오늘 기록 없음/);
});

test('한 줄: 출처별 개수와 실패 개수', () => {
  assert.equal(reviewCheckLine({ checked: 1509, updated: 1509, failed: 0, viaGetItems: 1500, viaAppreviews: 6, viaStore: 3 }),
    '⭐ 리뷰 갱신 1509/1509개 (GetItems 1500 · appreviews 6 · 상점 페이지 3) · 갱신 실패 0개');
  assert.equal(reviewCheckLine({ checked: 1509, updated: 1505, failed: 4, viaGetItems: 1500, viaAppreviews: 0, viaStore: 5 }),
    '⭐ 리뷰 갱신 1505/1509개 (GetItems 1500 · appreviews 0 · 상점 페이지 5) · 갱신 실패 4개');
});

test('하나도 못 받으면 경고', () => {
  assert.match(reviewCheckLine({ checked: 10, updated: 0, failed: 10, viaGetItems: 0, viaAppreviews: 0, viaStore: 0 }), /모든 경로 막힘/);
});

test('KR 재시도 개수가 줄 끝에 붙음 (옛 기록에는 없으면 생략)', () => {
  assert.equal(reviewCheckLine({ checked: 1512, updated: 1511, failed: 1, viaGetItems: 1511, viaAppreviews: 0, viaStore: 0, krRetried: 9 }),
    '⭐ 리뷰 갱신 1511/1512개 (GetItems 1511 · appreviews 0 · 상점 페이지 0) · 갱신 실패 1개 · KR 재시도 9개');
  assert.equal(reviewCheckLine({ checked: 5, updated: 5, failed: 0, viaGetItems: 5, viaAppreviews: 0, viaStore: 0, krRetried: 0 }),
    '⭐ 리뷰 갱신 5/5개 (GetItems 5 · appreviews 0 · 상점 페이지 0) · 갱신 실패 0개 · KR 재시도 0개');
});
