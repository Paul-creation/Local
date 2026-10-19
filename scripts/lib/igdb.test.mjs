import test from 'node:test';
import assert from 'node:assert/strict';
import { candidateMax, steamLookupBody, sameName, isBlank, igdbValues, derivePlatform } from './igdb.mjs';

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

test('이름 비교: 대소문자·공백·기호를 무시하고 정확히 같을 때만 같다', () => {
  assert.equal(sameName('Half-Life 2', 'half life 2'), true);
  assert.equal(sameName('THE FINALS', 'The Finals'), true);
  assert.equal(sameName('Portal 2', 'Portal Maze 2'), false);
  assert.equal(sameName('Slay the Spire', 'Slay the Spire II'), false);
  assert.equal(sameName('', ''), false);
});

test('빈칸 판정과 IGDB 값 뽑기', () => {
  assert.equal(isBlank(null) && isBlank('') && isBlank([]), true);
  assert.equal(isBlank(0) || isBlank(['a']), false);
  const v = igdbValues({ genres: [{ name: 'RPG' }], aggregated_rating: 81.6, involved_companies: [{ company: { name: 'A' }, developer: true }, { company: { name: 'B' }, publisher: true }] });
  assert.deepEqual(v, { genres: ['RPG'], themes: [], critic_score: 82, developer: 'A', publisher: 'B' });
});

test('플랫폼: 스토어 코드는 유지하고 IGDB 플랫폼을 더한다, 스팀 앱 ID가 없으면 steam은 뺀다', () => {
  const igdb = [{ name: 'PC (Microsoft Windows)' }, { name: 'PlayStation 5' }];
  assert.deepEqual(derivePlatform(['epic'], igdb, false), ['epic', 'ps5']);
  assert.deepEqual(derivePlatform(['steam'], igdb, true), ['steam', 'ps5']);
  assert.equal(derivePlatform(['steam'], [], true), null);
});
