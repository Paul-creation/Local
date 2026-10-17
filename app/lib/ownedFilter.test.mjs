import test from 'node:test';
import assert from 'node:assert/strict';
import { dropOwned } from './ownedFilter.ts';

const games = [
  { id: 'a', steam_appid: '526870' },
  { id: 'b', steam_appid: 620 },
  { id: 'c', steam_appid: null },
];
const ids = (l) => l.map((g) => g.id);
const none = () => false;

test('보유 게임을 뺀다 (문자열·숫자 appid 모두)', () => {
  assert.deepEqual(ids(dropOwned(games, new Set([526870, 620]), none)), ['c']);
});
test('보유 목록이 없거나 비어 있으면 그대로', () => {
  assert.deepEqual(ids(dropOwned(games, null, none)), ['a', 'b', 'c']);
  assert.deepEqual(ids(dropOwned(games, new Set(), none)), ['a', 'b', 'c']);
});
test('사용자가 이름을 직접 쓴 게임은 남긴다', () => {
  assert.deepEqual(ids(dropOwned(games, new Set([526870, 620]), (g) => g.id === 'a')), ['a', 'c']);
});
test('appid가 없는 게임은 항상 남긴다', () => {
  assert.deepEqual(ids(dropOwned(games, new Set([1]), none)), ['a', 'b', 'c']);
});
