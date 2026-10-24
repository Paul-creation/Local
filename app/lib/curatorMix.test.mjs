// 실행: npm test — 인스타 섹션 카드 섞기
import test from 'node:test';
import assert from 'node:assert/strict';
import { mixByCurator, latestPerGame } from './curatorMix.ts';

const mk = (s) => s.split('').map((c, i) => ({ curator: c, id: `${c}${i}` }));
const run = (list) => { let m = 0, r = 0, prev = ''; for (const x of list) { r = x.curator === prev ? r + 1 : 1; prev = x.curator; m = Math.max(m, r); } return m; };

test('한 계정이 3장 연속 나오지 않는다 (다른 계정의 최신 카드를 먼저)', () => {
  const out = mixByCurator(mk('AAAABBBBCC'), 12);
  assert.equal(out.length, 10);
  assert.ok(run(out) <= 2);
  assert.deepEqual(out.slice(0, 3).map((x) => x.id), ['A0', 'A1', 'B4']);
});

test('이미 번갈아 있으면 순서 그대로, 최대 12장', () => {
  const out = mixByCurator(mk('ABABABABABABAB'), 12);
  assert.equal(out.length, 12);
  assert.deepEqual(out.map((x) => x.id), mk('ABABABABABABAB').slice(0, 12).map((x) => x.id));
});

test('담을 다른 계정이 없으면 규칙을 어기지 않고 멈춘다', () => {
  const out = mixByCurator(mk('AAAAAB'), 12);
  assert.ok(run(out) <= 2);
  assert.equal(out.length, 5); // A A B A A (A는 더 못 붙임)
  assert.equal(mixByCurator(mk('AAAA'), 12).length, 2);
  assert.deepEqual(mixByCurator([], 12), []);
});

test('같은 게임은 최신 게시물 하나만', () => {
  const posts = [{ game_id: 'g1', c: 'new' }, { game_id: 'g2', c: 'x' }, { game_id: 'g1', c: 'old' }];
  assert.deepEqual(latestPerGame(posts), [{ game_id: 'g1', c: 'new' }, { game_id: 'g2', c: 'x' }]);
});
