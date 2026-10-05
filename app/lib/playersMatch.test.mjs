// 실행: npm test (Node 내장 테스트, .ts를 바로 불러온다)
import test from 'node:test';
import assert from 'node:assert/strict';
import { overlapsPlayers } from './playersMatch.ts';

const g = (min, max, party) => ({ min_players: min, max_players: max, party_max: party });
const G = { a68: g(6, 8), a112: g(1, 12), a14: g(1, 4), a11: g(1, 1), a23: g(2, 3), a58: g(5, 8), a44: g(4, 4), a48: g(4, 8) };
const pick = (r) => Object.entries(G).filter(([, x]) => overlapsPlayers(x, r)).map(([k]) => k);

test('1~12: 6~8, 1~12, 1~4, 1~1 모두 포함', () => {
  const got = pick([1, 12]);
  for (const k of ['a68', 'a112', 'a14', 'a11']) assert.ok(got.includes(k), k);
});

test('4~4: 4명 가능한 게임만', () => {
  assert.deepEqual(pick([4, 4]), ['a112', 'a14', 'a44', 'a48']);
});

test('2~3: 4~8 제외, 1~4 포함', () => {
  const got = pick([2, 3]);
  assert.ok(!got.includes('a48') && !got.includes('a58') && !got.includes('a68'));
  assert.ok(got.includes('a14'));
});

test('상관없음~상관없음: 필터 없음과 같다 (정보 없는 게임 포함)', () => {
  for (const x of [...Object.values(G), g(null, null), g(null, 4)]) assert.ok(overlapsPlayers(x, [0, 16]));
});

test('상관없음~12: 최소 인원이 12 이하면 전부 (최대가 12 미만이어도)', () => {
  assert.deepEqual(pick([0, 12]), Object.keys(G));
});

test('최소 인원이 비어 있으면 1명부터로 본다', () => {
  assert.ok(overlapsPlayers(g(null, 4), [1, 1]));
  assert.ok(!overlapsPlayers(g(null, 4), [5, 8]));
});

test('최대 인원을 모르면 범위를 움직일 때 빠진다 (예전 동작)', () => {
  assert.ok(!overlapsPlayers(g(2, null), [1, 12]));
  assert.ok(!overlapsPlayers(g(null, null), [3, 3]));
});

test('16명+ 끝 눈금은 위쪽 조건이 없다 / 팀 인원(party_max)이 있으면 그걸 최대로', () => {
  assert.ok(overlapsPlayers(g(20, 64), [16, 16]));
  assert.ok(!overlapsPlayers(g(1, 32, 7), [8, 8]));
  assert.ok(overlapsPlayers(g(1, 32, 7), [7, 7]));
});
