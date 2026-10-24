// 실행: npm test — 소개문 검사의 "멀티 없는 게임" 판단
import test from 'node:test';
import assert from 'node:assert/strict';
import { hasCoop, noMulti } from './fun-desc-rules.mjs';

test('최대 인원 1이면 멀티 없음', () => {
  assert.equal(noMulti({ max_players: 1 }), true);
  assert.equal(noMulti({ max_players: 1, has_online_coop: true }), true);
});

test('최대 인원이 null이면 모름 — 멀티 없는 게임으로 보지 않음', () => {
  assert.equal(noMulti({ max_players: null }), false);
  assert.equal(noMulti({}), false);
  assert.equal(noMulti({ max_players: null, solo_playable: false, min_players: 1 }), false);
});

test('인원이 있고 협동·대전이 없으면 멀티 없음, 있으면 멀티', () => {
  assert.equal(noMulti({ max_players: 0 }), true);
  assert.equal(noMulti({ max_players: 4, has_online_coop: true }), false);
  assert.equal(noMulti({ max_players: 2 }), false);
});

test('협동 판정', () => {
  assert.equal(hasCoop({ has_local_coop: true }), true);
  assert.equal(hasCoop({ has_pvp: true }), false);
});
