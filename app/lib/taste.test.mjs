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
