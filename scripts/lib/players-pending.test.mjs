import test from 'node:test';
import assert from 'node:assert/strict';
import { steamClass, sortPending, buildRow } from './players-pending.mjs';

test('스팀 카테고리: 싱글만 → single, 멀티·협동·대전 있음 → multi, 없음·정보 없음 → none', () => {
  assert.equal(steamClass(['Single-player', 'Steam Achievements']), 'single');
  assert.equal(steamClass(['Single-player', 'Online Co-op']), 'multi');
  assert.equal(steamClass(['Multi-player', 'Online PvP']), 'multi');
  assert.equal(steamClass(['Steam Achievements']), 'none');
  assert.equal(steamClass([]), 'none');
  assert.equal(steamClass(null), 'none');
});

test('정렬: 접속자 많은 순, 접속자 모르는 게임은 뒤', () => {
  const rows = [{ name: 'b', current_players: null }, { name: 'a', current_players: 5 }, { name: 'c', current_players: 50 }];
  assert.deepEqual(sortPending(rows).map((r) => r.name), ['c', 'a', 'b']);
});

test('행: IGDB 후보값과 스팀 분류를 함께 담는다', () => {
  const row = buildRow({ id: 'x', name: 'N', steam_appid: 1, min_players: 1, current_players: 7, heat_rank: 3 }, ['Multi-player'], { name: 'N', via: 'appid', max: 4 });
  assert.equal(row.steam_class, 'multi');
  assert.equal(row.igdb_max_candidate, 4);
  assert.equal(row.igdb_via, 'appid');
  assert.equal(buildRow({ id: 'y', name: 'M' }, null, null).igdb_max_candidate, null);
});
