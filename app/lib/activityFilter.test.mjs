import test from 'node:test';
import assert from 'node:assert/strict';
import { matchesActivities, countActivities } from './activityFilter.ts';

const g = (c, u) => ({ activities_confirmed: c, activities_unsure: u });

test('고른 활동을 모두 가진 게임만(AND), 기본은 확정만', () => {
  assert.equal(matchesActivities(g(['drive', 'train']), ['drive', 'train'], false), true);
  assert.equal(matchesActivities(g(['drive']), ['drive', 'train'], false), false);
  assert.equal(matchesActivities(g(['drive'], ['train']), ['drive', 'train'], false), false);
  assert.equal(matchesActivities(g(['drive'], ['train']), ['drive', 'train'], true), true);
  assert.equal(matchesActivities({}, [], false), true);
  assert.equal(matchesActivities({}, ['drive'], true), false);
});

test('활동별 게임 수 — 확인 중 포함이면 합산, 한 게임은 한 번만', () => {
  const games = [g(['drive'], ['train']), g(['drive', 'train']), g([], ['drive']), {}];
  const keys = ['drive', 'train'];
  assert.equal(countActivities(games, false, keys).get('drive'), 2);
  assert.equal(countActivities(games, false, keys).get('train'), 1);
  assert.equal(countActivities(games, true, keys).get('drive'), 3);
  assert.equal(countActivities(games, true, keys).get('train'), 2);
  assert.equal(countActivities([g(['drive'], ['drive'])], true, ['drive']).get('drive'), 1);
  assert.equal(countActivities(games, false, ['fish']).has('fish'), false);
});

test('같은 뜻의 태그가 있으면 활동 OR 태그로 본다', () => {
  const withTag = { id: 'a', tagHit: ['drive'] };
  const alsoHas = (game, key) => !!game.tagHit?.includes(key);
  assert.equal(matchesActivities(withTag, ['drive'], false, alsoHas), true);
  assert.equal(matchesActivities(withTag, ['drive'], false), false);
  assert.equal(matchesActivities(withTag, ['drive', 'train'], false, alsoHas), false);
  assert.equal(matchesActivities({ activities_confirmed: ['train'], tagHit: ['drive'] }, ['drive', 'train'], false, alsoHas), true);
  assert.equal(countActivities([withTag, g(['drive'])], false, ['drive'], alsoHas).get('drive'), 2);
});
