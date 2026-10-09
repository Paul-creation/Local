// 실행: npm test — 메인 인원별 추천에서 보여줄 게임 고르기 (필터 꺼짐 / 일부 통과 / 전부 실패 — 추천 칸은 후보가 있는 한 비지 않는다)
import test from 'node:test';
import assert from 'node:assert/strict';
import { choosePeopleGames, PEOPLE_SHOW, PEOPLE_CANDIDATES } from './peopleShow.ts';

const cands = Array.from({ length: PEOPLE_CANDIDATES }, (_, i) => ({ id: `g${i + 1}` }));
const ids = (r) => r.games.map((g) => g.id);
const only = (...pass) => (g) => pass.includes(g.id);

test('후보 12개, 보여주는 건 3개', () => {
  assert.equal(PEOPLE_CANDIDATES, 12);
  assert.equal(PEOPLE_SHOW, 3);
});

test('필터 꺼짐(사양 없음 포함) → 앞 3개, 예전과 같은 순서', () => {
  const r = choosePeopleGames(cands, null);
  assert.deepEqual(ids(r), ['g1', 'g2', 'g3']);
  assert.equal(r.filteredOut, false);
});

test('필터 켜짐·통과 3개 이상 → 통과분 앞 3개 (앞 후보가 미달이어도 뒤에서 채움)', () => {
  const r = choosePeopleGames(cands, only('g2', 'g5', 'g7', 'g9', 'g12'));
  assert.deepEqual(ids(r), ['g2', 'g5', 'g7']);
  assert.equal(r.filteredOut, false);
});

test('필터 켜짐·일부 통과(1~2개) → 통과분이 앞, 남는 자리는 통과 못 한 후보를 필터 전 순서대로 채움 (안내 없음)', () => {
  const one = choosePeopleGames(cands, only('g11'));
  assert.deepEqual(ids(one), ['g11', 'g1', 'g2']);
  assert.equal(one.filteredOut, false);
  const two = choosePeopleGames(cands, only('g2', 'g6'));
  assert.deepEqual(ids(two), ['g2', 'g6', 'g1']);
  assert.equal(two.filteredOut, false);
  assert.equal(one.games.length, 3);
});

test('필터 켜짐·전부 실패 → 필터 전 앞 3개 + 안내(filteredOut)', () => {
  const r = choosePeopleGames(cands, () => false);
  assert.deepEqual(ids(r), ['g1', 'g2', 'g3']);
  assert.equal(r.filteredOut, true);
});

test('후보가 3개보다 적으면 있는 만큼 (채우기도 후보 안에서만)', () => {
  const few = cands.slice(0, 2);
  assert.deepEqual(ids(choosePeopleGames(few, only('g2'))), ['g2', 'g1']);
  assert.deepEqual(ids(choosePeopleGames(few, () => false)), ['g1', 'g2']);
});

test('후보 자체가 없으면 사양 안내가 아니라 "데이터 없음" (빈 목록, filteredOut false)', () => {
  const a = choosePeopleGames([], () => false);
  assert.deepEqual(a.games, []);
  assert.equal(a.filteredOut, false);
  assert.deepEqual(choosePeopleGames([], null).games, []);
});
