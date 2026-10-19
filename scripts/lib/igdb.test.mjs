import test from 'node:test';
import assert from 'node:assert/strict';
import { candidateMax, steamLookupBody } from './igdb.mjs';

test('스팀 앱 ID 조회는 external_game_source = 1을 쓴다 (category 조건은 IGDB에서 사라짐)', () => {
  const body = steamLookupBody('1672970', 'game.name');
  assert.match(body, /uid = "1672970"/);
  assert.match(body, /external_game_source = 1/);
  assert.doesNotMatch(body, /category/);
});

test('최대 인원 후보: 온라인 협동 → 로컬 협동 → 온라인 대전 순, 없으면 null', () => {
  assert.equal(candidateMax([{ onlinecoopmax: 4, offlinecoopmax: 2, onlinemax: 8 }]), 4);
  assert.equal(candidateMax([{ offlinecoopmax: 2, onlinemax: 8 }]), 2);
  assert.equal(candidateMax([{ onlinemax: 8 }]), 8);
  assert.equal(candidateMax([{}]), null);
  assert.equal(candidateMax([]), null);
  assert.equal(candidateMax(undefined), null);
});
