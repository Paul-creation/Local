// 실행: npm test — 검색 "지금 뜨는 게임" 필터 (주소 ↔ 선택, 매칭, 점수순)
import test from 'node:test';
import assert from 'node:assert/strict';
import { trendFromUrl, trendToUrl, matchesTrend, byTrendScore } from './trendFilter.ts';

test('주소 ↔ 선택: 모르는 값은 버리고 순서는 고정', () => {
  assert.deepEqual(trendFromUrl('rising,new'), ['rising', 'new']);
  assert.equal(trendToUrl(['rising', 'new']), 'new,rising');
  assert.deepEqual(trendFromUrl('x,,new'), ['new']);
  assert.deepEqual(trendFromUrl(null), []);
});

test('신작은 new만, 다시 뜨는 중은 rising_old·rising_recent, 둘 다 켜면 합집합, 안 켜면 전부', () => {
  const g = (trend_badge) => ({ trend_badge });
  assert.equal(matchesTrend(g('new'), ['new']), true);
  assert.equal(matchesTrend(g('rising_old'), ['new']), false);
  assert.equal(matchesTrend(g('rising_old'), ['rising']), true);
  assert.equal(matchesTrend(g('rising_recent'), ['rising']), true);
  assert.equal(matchesTrend(g('new'), ['rising']), false);
  assert.equal(matchesTrend(g('new'), ['new', 'rising']), true);
  assert.equal(matchesTrend(g(null), ['new', 'rising']), false);
  assert.equal(matchesTrend(g(undefined), []), true);
});

test('점수 내림차순, 같으면 인기순(heat_rank)', () => {
  const list = [{ id: 'a', trend_score: 0.4, heat_rank: 1 }, { id: 'b', trend_score: 0.9, heat_rank: 50 }, { id: 'c', trend_score: 0.4, heat_rank: 5 }];
  assert.deepEqual(list.sort(byTrendScore).map((x) => x.id), ['b', 'a', 'c']);
});
