// 실행: npm test — 인스타 섹션 카드 고르기 (계정별 라운드로빈)
import test from 'node:test';
import assert from 'node:assert/strict';
import { roundRobinByCurator, latestPerGame } from './curatorMix.ts';

const mk = (s) => s.split('').map((c, i) => ({ curator: c, id: `${c}${i}` }));
const ids = (list) => list.map((x) => x.id);

test('계정 순서(가장 최근 게시물 순)대로 한 장씩 번갈아, 계정 안은 최신순', () => {
  // 최신순: A0 A1 B2 A3 C4 B5 → A 큐 [A0 A1 A3], B 큐 [B2 B5], C 큐 [C4]
  assert.deepEqual(ids(roundRobinByCurator(mk('AABACB'), 12)), ['A0', 'B2', 'C4', 'A1', 'B5', 'A3']);
});

test('한 계정 게임이 바닥나면 나머지 계정끼리 계속', () => {
  assert.deepEqual(ids(roundRobinByCurator(mk('AAAAAB'), 12)), ['A0', 'B5', 'A1', 'A2', 'A3', 'A4']);
  assert.deepEqual(ids(roundRobinByCurator(mk('AAAA'), 12)), ['A0', 'A1', 'A2', 'A3']);
});

test('최대 12장에서 자르고 모든 계정이 앞쪽 라운드에 나온다', () => {
  const out = roundRobinByCurator(mk('AAAAAAAAAAAAAAAABBBBCCCCDDDD'), 12);
  assert.equal(out.length, 12);
  assert.deepEqual([...new Set(out.map((x) => x.curator))].sort(), ['A', 'B', 'C', 'D']);
  assert.deepEqual(out.slice(0, 4).map((x) => x.curator), ['A', 'B', 'C', 'D']);
  assert.deepEqual(roundRobinByCurator([], 12), []);
});

test('같은 게임은 최신 게시물 하나만', () => {
  const posts = [{ game_id: 'g1', c: 'new' }, { game_id: 'g2', c: 'x' }, { game_id: 'g1', c: 'old' }];
  assert.deepEqual(latestPerGame(posts), [{ game_id: 'g1', c: 'new' }, { game_id: 'g2', c: 'x' }]);
});
