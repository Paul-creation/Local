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
  assert.equal(countActivities(games, false).get('drive'), 2);
  assert.equal(countActivities(games, false).get('train'), 1);
  assert.equal(countActivities(games, true).get('drive'), 3);
  assert.equal(countActivities(games, true).get('train'), 2);
  assert.equal(countActivities([g(['drive'], ['drive'])], true).get('drive'), 1);
});
