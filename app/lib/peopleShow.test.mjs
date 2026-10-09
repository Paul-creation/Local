// 실행: npm test — 메인 인원별 추천에서 보여줄 게임 고르기 (필터 꺼짐 / 일부 통과 / 전부 실패)
import test from 'node:test';
import assert from 'node:assert/strict';
import { choosePeopleGames, PEOPLE_SHOW, PEOPLE_CANDIDATES } from './peopleShow.ts';

const cands = Array.from({ length: PEOPLE_CANDIDATES }, (_, i) => ({ id: `g${i + 1}` }));
const ids = (r) => r.games.map((g) => g.id);

test('후보 12개, 보여주는 건 3개', () => {
  assert.equal(PEOPLE_CANDIDATES, 12);
  assert.equal(PEOPLE_SHOW, 3);
});

test('필터 꺼짐(사양 없음 포함) → 앞 3개, 예전과 같은 순서', () => {
  const r = choosePeopleGames(cands, null);
  assert.deepEqual(ids(r), ['g1', 'g2', 'g3']);
  assert.equal(r.filteredOut, false);
});

test('필터 켜짐·일부 통과 → 통과분 앞 3개 (앞 후보가 미달이어도 뒤에서 채움)', () => {
  const passes = new Set(['g2', 'g5', 'g7', 'g9', 'g12']);
  const r = choosePeopleGames(cands, (g) => passes.has(g.id));
  assert.deepEqual(ids(r), ['g2', 'g5', 'g7']);
  assert.equal(r.filteredOut, false);
});

test('필터 켜짐·통과가 3개 미만 → 있는 만큼만, 안내는 안 띄움', () => {
  const r = choosePeopleGames(cands, (g) => g.id === 'g11');
  assert.deepEqual(ids(r), ['g11']);
  assert.equal(r.filteredOut, false);
});

test('필터 켜짐·전부 실패 → 0개 + 사양 안내(filteredOut)', () => {
  const r = choosePeopleGames(cands, () => false);
  assert.deepEqual(ids(r), []);
  assert.equal(r.filteredOut, true);
});

test('후보 자체가 없으면 사양 안내가 아니라 "데이터 없음" (filteredOut false)', () => {
  assert.equal(choosePeopleGames([], () => false).filteredOut, false);
  assert.equal(choosePeopleGames([], null).filteredOut, false);
});
