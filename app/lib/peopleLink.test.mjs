// 실행: npm test (Node 내장 테스트, .ts를 바로 불러온다)
import test from 'node:test';
import assert from 'node:assert/strict';
import { peopleHref, peopleButtonTarget } from './peopleLink.ts';

const MAX = 16; // PLAYERS_MAX(=LARGE_LOBBY)와 같은 값이어야 주소가 같다 — 값만 바뀌어도 이 테스트는 인자로 받아 통과한다
const CHOICES = [2, 3, 4, 5]; // PEOPLE_CHOICES — 5는 "5인 이상"

test('인원별 추천이 없으면(recsReady 거짓) 인원 버튼은 그 인원의 검색 주소로 이동한다', () => {
  const want = { 2: '/?players=2-2', 3: '/?players=3-3', 4: '/?players=4-4', 5: `/?players=5-${MAX}` };
  for (const n of CHOICES) assert.equal(peopleButtonTarget(false, n, false, MAX), want[n], `${n}인`);
});

test('내 PC 조건이 켜져 있으면 &mypc=1이 붙는다', () => {
  for (const n of CHOICES) assert.equal(peopleButtonTarget(false, n, true, MAX), `${peopleHref(n, false, MAX)}&mypc=1`);
});

test('인원별 추천이 있으면(recsReady 참) 이동하지 않는다', () => {
  for (const n of CHOICES) {
    assert.equal(peopleButtonTarget(true, n, false, MAX), null);
    assert.equal(peopleButtonTarget(true, n, true, MAX), null);
  }
});

test('"전체 보기" 링크와 같은 주소를 쓴다', () => {
  assert.equal(peopleHref(5, false, 8), '/?players=5-8');
  assert.equal(peopleHref(2, true, 8), '/?players=2-2&mypc=1');
});
