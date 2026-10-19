import test from 'node:test';
import assert from 'node:assert/strict';
import { planFix, sameValue } from './igdb-fix.mjs';

const base = { genres: ['A'], themes: [], critic_score: 70, developer: 'Wrong', publisher: null, platform: ['steam'] };

test('값 비교: 배열은 순서 무시, 빈 값끼리는 같다', () => {
  assert.equal(sameValue(['b', 'a'], ['a', 'b']), true);
  assert.equal(sameValue(null, []), true);
  assert.equal(sameValue('x', 'y'), false);
});

test('DB 값이 예전 이름 검색 값과 같으면 앱 ID 값으로 바꾼다', () => {
  const plan = planFix(base, { ...base }, { ...base, developer: 'Right', genres: ['B'], critic_score: null });
  assert.deepEqual(Object.keys(plan.changes).sort(), ['critic_score', 'developer', 'genres']);
  assert.deepEqual(plan.changes.developer, { before: 'Wrong', after: 'Right' });
  assert.equal(plan.changes.critic_score.after, null);
  assert.deepEqual(plan.kept, []);
});

test('나중에 다른 값이 들어간 칸은 건드리지 않고 알린다', () => {
  const plan = planFix({ ...base, developer: 'Manual' }, { ...base }, { ...base, developer: 'Right' });
  assert.deepEqual(plan.changes, {});
  assert.deepEqual(plan.kept, ['developer']);
});

test('이미 앱 ID 값과 같으면 바꾸지 않고, IGDB 플랫폼이 없으면(null) 플랫폼은 비교하지 않는다', () => {
  assert.deepEqual(planFix(base, { ...base }, { ...base, platform: null }), { changes: {}, kept: [] });
});
