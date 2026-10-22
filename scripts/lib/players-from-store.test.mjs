import test from 'node:test';
import assert from 'node:assert/strict';
import { extractPlayers, toSentences } from './players-from-store.mjs';

const run = (...t) => extractPlayers(t);

test('숫자가 하나: up to 4 players → 4', () => {
  const r = run('Team up with friends in up to 4 players online.');
  assert.equal(r.status, 'fill');
  assert.equal(r.max, 4);
});

test('범위 표기: 1-4 player co-op → max 4, min은 범위의 아래쪽', () => {
  const r = run('<p>Play 1-4 player co-op through the campaign.</p>');
  assert.deepEqual([r.status, r.max], ['fill', 4]);
  assert.equal(r.min, 1);
  assert.equal(run('Enjoy 2-8 players online.').min, 2);
});

test('4-player co-op, 영어 숫자 단어', () => {
  assert.equal(run('A four-player co-op adventure.').max, 4);
  assert.equal(run('Fast 4-player co-op action.').max, 4);
});

test('한국어: 최대 4인, 2~4명', () => {
  assert.equal(run('최대 4인 협동 플레이').max, 4);
  const r = run('2~6명이 함께 즐기는 파티 게임');
  assert.deepEqual([r.max, r.min], [6, 2]);
});

test('같은 숫자가 여러 문장에 있어도 하나로 본다', () => {
  const r = run('Up to 4 players.', 'Play with 4 players online.');
  assert.deepEqual([r.status, r.max], ['fill', 4]);
});

test('숫자가 여럿인데 협동·대전으로 나뉘면 같은 판 최대(큰 값)', () => {
  const r = run('Cooperative campaign for 4 players. Competitive PvP matches for 8 players.');
  assert.deepEqual([r.status, r.max], ['fill', 8]);
});

test('숫자가 여럿이고 라벨이 없으면 대기 + 근거 문장', () => {
  const r = run('Up to 4 players on one screen. 2 players online.');
  assert.equal(r.status, 'pending');
  assert.equal(r.reason, 'multi');
  assert.equal(r.evidence.length, 2);
});

test('17명 이상(서버·대규모)은 자동 반영하지 않고 대기', () => {
  for (const t of ['Up to 64 players on huge servers.', 'Battle with 100 players.', 'Co-op for up to 4 players, servers up to 32 players.']) {
    const r = run(t);
    assert.equal(r.status, 'pending', t);
    assert.equal(r.reason, 'large', t);
  }
});

test('1인 표기·인원 문장 없음은 none', () => {
  assert.equal(run('A 1 player adventure. Single-player story.').status, 'none');
  assert.equal(run('Explore a vast world.', '').status, 'none');
});

test('HTML 태그·엔티티를 풀고 문장으로 나눈다', () => {
  assert.deepEqual(toSentences('<p>Hello there.</p><ul><li>Up to 4 players &amp; bots</li></ul>'), ['Hello there.', 'Up to 4 players & bots']);
});

test('애매한 표기는 채우지 않고 대기: NvN만, 친구 N명, 권장·더 해도 됨, 로컬만', () => {
  assert.equal(run('Intense 5v5 tactical shooter.').reason, 'versus-only');
  assert.equal(run('Play 1v1 duels. Rogue-lite shooter.').status, 'pending');
  assert.equal(run('Invite up to 10 friends to play in a league.').reason, 'friends');
  assert.equal(run('We recommend up to 3 players (but you are welcome to play with more).').reason, 'hedge');
  assert.equal(run('Engage in split-screen competitions (up to 4 players).').reason, 'local-only');
  assert.equal(run('Up to 4 players, local or online.').status, 'fill');
});

test('협동 숫자뿐인데 다른 문장에 대전이 있으면 대기, 숫자 문장 자체가 대전이면 채움', () => {
  assert.equal(run('A co-op action game for up to four players.', 'Also features a versus mode.').reason, 'also-versus');
  assert.equal(run('Competitive and Co-op play for up to 4 players.').status, 'fill');
});

test('친구 N명 표기가 있어도 "N players"가 따로 있으면 그 숫자로 정한다', () => {
  const r = run('Solo or co-op with up to 4 friends.', 'A base-building game for up to 4 players.');
  assert.deepEqual([r.status, r.max], ['fill', 4]);
});
