// 실행: npm test — 취향 벡터·코사인·상위 k개
import test from 'node:test';
import assert from 'node:assert/strict';
import { gameVector, cosine, topSimilar, ACTIVITY_WEIGHT } from './taste.ts';

const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} ≈ ${b}`);

test('태그 가중치는 √(득표/최대 득표), 활동은 0.5', () => {
  const v = gameVector([{ tag_id: 1, votes: 400 }, { tag_id: 2, votes: 100 }], ['craft']);
  close(v.w.get('t1'), 1);
  close(v.w.get('t2'), 0.5);
  assert.equal(v.w.get('a:craft'), ACTIVITY_WEIGHT);
  close(v.norm, Math.sqrt(1 + 0.25 + 0.25));
});

test('득표가 없거나 0 이하인 태그는 뺀다, 태그·활동이 없으면 빈 벡터', () => {
  const v = gameVector([{ tag_id: 1, votes: null }, { tag_id: 2, votes: 0 }, { tag_id: 3, votes: -5 }], null);
  assert.equal(v.w.size, 0);
  assert.equal(v.norm, 0);
});

test('같은 벡터는 1, 겹치는 칸이 없으면 0, 빈 벡터는 0', () => {
  const a = gameVector([{ tag_id: 1, votes: 10 }], ['x']);
  const b = gameVector([{ tag_id: 2, votes: 10 }], ['y']);
  close(cosine(a, a), 1);
  assert.equal(cosine(a, b), 0);
  assert.equal(cosine(a, gameVector([], [])), 0);
});

test('코사인은 대칭이고 직접 계산한 값과 같다', () => {
  const a = gameVector([{ tag_id: 1, votes: 100 }, { tag_id: 2, votes: 25 }], []);
  const b = gameVector([{ tag_id: 1, votes: 100 }, { tag_id: 3, votes: 100 }], []);
  close(cosine(a, b), cosine(b, a));
  close(cosine(a, b), 1 / (Math.sqrt(1.25) * Math.sqrt(2)));
});

test('득표가 같은 태그라도 활동이 겹치면 더 비슷하다', () => {
  const src = { id: 's', vec: gameVector([{ tag_id: 1, votes: 10 }], ['craft', 'build']) };
  const withAct = { id: 'a', vec: gameVector([{ tag_id: 1, votes: 10 }], ['craft', 'build']) };
  const noAct = { id: 'n', vec: gameVector([{ tag_id: 1, votes: 10 }], ['fish']) };
  const r = topSimilar(src, [noAct, withAct], 5);
  assert.deepEqual(r.map((x) => x.id), ['a', 'n']);
});

test('topSimilar: 자기 자신·유사도 0 제외, k개 제한, 동점은 앞 후보 먼저', () => {
  const mk = (id, tags) => ({ id, vec: gameVector(tags, []) });
  const src = mk('s', [{ tag_id: 1, votes: 10 }]);
  const list = [src, mk('x', [{ tag_id: 1, votes: 10 }]), mk('y', [{ tag_id: 1, votes: 10 }]), mk('z', [{ tag_id: 9, votes: 10 }]), mk('w', [{ tag_id: 1, votes: 10 }, { tag_id: 2, votes: 10 }])];
  const r = topSimilar(src, list, 2);
  assert.deepEqual(r.map((x) => x.id), ['x', 'y']);
  assert.deepEqual(topSimilar(src, list, 10).map((x) => x.id), ['x', 'y', 'w']);
  assert.deepEqual(topSimilar(src, list, 0), []);
});

import { profileVector, saleBoost, rankByTaste } from './taste.ts';

test('취향 벡터는 보유 게임 벡터를 길이 1로 맞춰 더한다', () => {
  const a = gameVector([{ tag_id: 1, votes: 10 }], []);
  const b = gameVector([{ tag_id: 1, votes: 10 }, { tag_id: 2, votes: 10 }, { tag_id: 3, votes: 10 }], []);
  const p = profileVector([a, b]);
  close(p.w.get('t1'), 1 + 1 / Math.sqrt(3));
  close(p.w.get('t2'), 1 / Math.sqrt(3));
  assert.equal(profileVector([]).norm, 0);
});

test('할인 가산점: 코사인 × (1 + 0.15 × min(할인율, 50) / 50)', () => {
  close(saleBoost(0.5, 0), 0.5);
  close(saleBoost(0.5, 25), 0.5 * 1.075);
  close(saleBoost(0.5, 50), 0.5 * 1.15);
  close(saleBoost(0.5, 90), 0.5 * 1.15);
  close(saleBoost(0.5, null), 0.5);
  close(saleBoost(0.5, -10), 0.5);
});

test('보유하지 않은 게임을 취향 점수순으로, 할인이 점수를 조금 올린다', () => {
  const rows = [
    ['own1', [[1, 100]], []],
    ['own2', [[1, 100], [2, 25]], []],
    ['near', [[1, 100], [2, 25]], []],
    ['mid', [[1, 100], [3, 100]], []],
    ['far', [[9, 100]], []],
  ];
  const none = () => 0;
  const pop = () => 0;
  const r = rankByTaste(rows, new Set(['own1', 'own2']), none, pop);
  assert.deepEqual(r.map((x) => x.id), ['near', 'mid']); // far는 겹치는 태그가 없어 후보가 아님
  const withSale = rankByTaste(rows, new Set(['own1', 'own2']), (id) => (id === 'mid' ? 50 : 0), pop);
  assert.ok(withSale.find((x) => x.id === 'mid').score > r.find((x) => x.id === 'mid').score);
  assert.deepEqual(rankByTaste(rows, new Set(['own1', 'own2']), none, pop, 1).map((x) => x.id), ['near']);
});

test('동점은 인기순(popularity 작은 쪽)이 먼저, 보유 게임에 벡터가 없으면 빈 목록', () => {
  const rows = [['own', [[1, 10]], []], ['a', [[1, 10]], []], ['b', [[1, 10]], []]];
  const r = rankByTaste(rows, new Set(['own']), () => 0, (id) => (id === 'b' ? 1 : 5));
  assert.deepEqual(r.map((x) => x.id), ['b', 'a']);
  assert.deepEqual(rankByTaste(rows, new Set(['zzz']), () => 0, () => 0), []);
  assert.deepEqual(rankByTaste([['own', [], []], ['a', [[1, 10]], []]], new Set(['own']), () => 0, () => 0), []);
});
