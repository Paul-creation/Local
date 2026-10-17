import test from 'node:test';
import assert from 'node:assert/strict';
import { isFriendGame, fitsPeopleCount, friendGames } from './library.ts';

const g = (id, o = {}) => ({ id, has_online_coop: true, min_players: 1, max_players: 4, heat_rank: null, ...o });

test('온라인 협동·대전이 확인된 게임만, 1인 전용은 뺀다', () => {
  assert.equal(isFriendGame(g('a')), true);
  assert.equal(isFriendGame(g('b', { has_online_coop: false, has_pvp: true })), true);
  assert.equal(isFriendGame(g('c', { has_online_coop: false })), false);
  assert.equal(isFriendGame(g('d', { has_online_coop: null, has_pvp: null })), false);
  assert.equal(isFriendGame(g('e', { max_players: 1 })), false);
});

test('인원 판정: 최소 ≤ N ≤ 친구끼리 최대, 5는 5인 이상', () => {
  assert.equal(fitsPeopleCount(g('a'), 4), true);
  assert.equal(fitsPeopleCount(g('a'), 5), false);
  assert.equal(fitsPeopleCount(g('a', { min_players: 3 }), 2), false);
  assert.equal(fitsPeopleCount(g('a', { max_players: 16, party_max: 4 }), 5), false);
  assert.equal(fitsPeopleCount(g('a', { max_players: 16 }), 5), true);
  assert.equal(fitsPeopleCount(g('a', { max_players: null }), 2), false);
});

test('인원에 맞는 게임이 먼저, 각각 인기순(순위 없으면 뒤)', () => {
  const owned = [g('slow', { heat_rank: 50 }), g('big', { max_players: 8, min_players: 6, heat_rank: 1 }), g('fast', { heat_rank: 3 }), g('none'), g('solo', { max_players: 1 })];
  const r = friendGames(owned, 2);
  assert.deepEqual(r.fit.map((x) => x.id), ['fast', 'slow', 'none']);
  assert.deepEqual(r.other.map((x) => x.id), ['big']);
});
