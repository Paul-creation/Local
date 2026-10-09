// 실행: npm test (Node 내장 테스트, .ts를 바로 불러온다)
import test from 'node:test';
import assert from 'node:assert/strict';
import { barrierLabel, infoChips, isNoKorean } from './cardInfo.ts';

test('진입장벽: entry_barrier가 우선, 없으면 difficulty를 낮음·보통·높음으로', () => {
  assert.equal(barrierLabel({ entry_barrier: '높음', difficulty: '쉬움' }), '높음');
  assert.equal(barrierLabel({ entry_barrier: null, difficulty: '쉬움' }), '낮음');
  assert.equal(barrierLabel({ difficulty: '보통' }), '보통');
  assert.equal(barrierLabel({ entry_barrier: '', difficulty: '어려움' }), '높음');
});

test('진입장벽: 모르는 값이나 빈 값이면 null (줄 숨김)', () => {
  assert.equal(barrierLabel({}), null);
  assert.equal(barrierLabel({ entry_barrier: null, difficulty: null }), null);
  assert.equal(barrierLabel({ entry_barrier: '??', difficulty: '??' }), null);
});

test('한국어 미지원은 "한국어 없음"일 때만 (모르면 칩 없음)', () => {
  assert.equal(isNoKorean('한국어 없음'), true);
  assert.equal(isNoKorean('자막'), false);
  assert.equal(isNoKorean('자막+더빙'), false);
  assert.equal(isNoKorean(null), false);
  assert.equal(isNoKorean(undefined), false);
});

test('칩 줄: 태그 최대 2개, 크로스플레이는 true일 때만, 한국어 미지원은 true일 때만', () => {
  assert.deepEqual(infoChips({}), []);
  assert.deepEqual(infoChips({ top_tags: ['협동', '액션', '공포'] }).map((c) => c.text), ['협동', '액션']);
  assert.deepEqual(infoChips({ has_crossplay: false, no_korean: false }), []);
  assert.deepEqual(infoChips({ top_tags: ['협동'], has_crossplay: true, no_korean: true }), [
    { text: '협동', kind: 'tag' },
    { text: '크로스플레이', kind: 'up' },
    { text: '한국어 미지원', kind: 'down' },
  ]);
  assert.deepEqual(infoChips({ has_crossplay: null }), []);
});
