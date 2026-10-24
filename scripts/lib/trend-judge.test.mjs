// 실행: npm test — 전체 게임 "지금 뜨는 게임" 판정 (app/lib/trending 규칙 그대로, 인원·핫차트 제외 없음)
import test from 'node:test';
import assert from 'node:assert/strict';
import { judgeTrends, planWrites, countByBadge } from './trend-judge.mjs';

const NOW = Date.parse('2026-10-19T00:00:00Z');
const daysAgo = (d) => new Date(NOW - d * 86400_000).toISOString();
const base = { hidden: false, review_total: 20000, recent_review_count: 500 };
// 최근 3일 5000, 7일 전 같은 3일 2500 → 증가율 2
const grown = [{ age: 1, count: 5000 }, { age: 2, count: 5000 }, { age: 8, count: 2500 }, { age: 9, count: 2500 }];

test('신작·다시 뜨는 중·요즘 뜨는 중을 가르고, 숨김·출시 예정·동접 부족·증가율 부족은 null', () => {
  const games = [
    { ...base, id: 'new', current_players: 2000, release_date: daysAgo(30) },
    { ...base, id: 'old', current_players: 5000, release_date: daysAgo(800) },
    { ...base, id: 'recent', current_players: 5000, release_date: daysAgo(200) },
    { ...base, id: 'hidden', hidden: true, current_players: 5000, release_date: daysAgo(30) },
    { ...base, id: 'soon', release_status: 'coming_soon', current_players: 5000, release_date: daysAgo(30) },
    { ...base, id: 'small', current_players: 100, release_date: daysAgo(30) },
    { ...base, id: 'flat', current_players: 5000, release_date: daysAgo(800) },
  ];
  const samples = new Map([['old', grown], ['recent', grown], ['flat', [{ age: 1, count: 5000 }, { age: 2, count: 5000 }, { age: 8, count: 5000 }, { age: 9, count: 5000 }]]]);
  const j = judgeTrends(games, samples, new Map(), NOW);
  assert.equal(j.get('new').badge, 'new');
  assert.equal(j.get('old').badge, 'rising_old');
  assert.equal(j.get('recent').badge, 'rising_recent');
  for (const id of ['hidden', 'soon', 'small', 'flat']) assert.equal(j.get(id), null, id);
  assert.deepEqual(countByBadge(j), { new: 1, rising_old: 1, rising_recent: 1 });
});

test('저장은 바뀐 것만: 판정은 새 점수로, 사라진 건 null로 초기화, 원래 null이면 건드리지 않음', () => {
  const games = [{ id: 'a', trend_badge: null }, { id: 'b', trend_badge: 'new', trend_score: 0.5 }, { id: 'c', trend_badge: null, trend_score: null }];
  const judged = new Map([['a', { badge: 'new', score: 0.7 }], ['b', null], ['c', null]]);
  assert.deepEqual(planWrites(games, judged, 'T'), [
    { id: 'a', trend_badge: 'new', trend_score: 0.7, trend_at: 'T' },
    { id: 'b', trend_badge: null, trend_score: null, trend_at: 'T' },
  ]);
});
