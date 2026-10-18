import test from 'node:test';
import assert from 'node:assert/strict';
import { sortGroupItems, gaugeRatio } from './voteLayout.ts';
import { VOTE_GROUPS, VOTE_SITUATIONS } from './situations.ts';

test('투표 많은 순, 동률은 기존 순서', () => {
  assert.deepEqual(sortGroupItems(['a', 'b', 'c', 'd'], { a: 1, b: 3, c: 1, d: 3 }), ['b', 'd', 'a', 'c']);
  assert.deepEqual(sortGroupItems(['a', 'b'], {}), ['a', 'b']);
});

test('게이지 비율은 최다 득표 대비, 투표가 없으면 0', () => {
  assert.equal(gaugeRatio(2, { a: 4, b: 2 }), 0.5);
  assert.equal(gaugeRatio(4, { a: 4 }), 1);
  assert.equal(gaugeRatio(0, {}), 0);
});

test('그룹은 투표 선택지 전체를 한 번씩 빠짐없이 담는다', () => {
  const flat = VOTE_GROUPS.flatMap(g => g.items);
  assert.equal(flat.length, VOTE_SITUATIONS.length);
  assert.deepEqual([...flat].sort(), [...VOTE_SITUATIONS].sort());
});
