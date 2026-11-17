// 실행: npm test — 사이트맵 lastmod: 실제 변경 시각만 쓰고, 오늘·미래 값은 쓰지 않음
import test from 'node:test';
import assert from 'node:assert/strict';
import { gameLastmod, LASTMOD_FIELDS } from './sitemapLastmod.ts';

const NOW = new Date('2026-11-17T00:00:00Z').getTime();

test('가장 늦은 실제 변경 시각을 쓴다', () => {
  const d = gameLastmod({ created_at: '2026-01-01T00:00:00Z', last_updated: '2026-05-01', fun_description_at: '2026-03-01T00:00:00Z', price_history: [{ checked_at: '2026-10-20T03:00:00Z' }] }, NOW);
  assert.equal(d.toISOString(), '2026-10-20T03:00:00.000Z');
});

test('가격 기록이 없으면 다른 날짜 중 가장 늦은 것', () => {
  assert.equal(gameLastmod({ created_at: '2026-01-01T00:00:00Z', last_updated: '2026-06-01', price_history: [] }, NOW).toISOString(), '2026-06-01T00:00:00.000Z');
});

test('접속자·리뷰·추세 시각은 읽지도 않는다', () => {
  assert.ok(!/recent_reviews_at|trend_at|players_/.test(LASTMOD_FIELDS));
  const d = gameLastmod({ created_at: '2026-01-01T00:00:00Z', recent_reviews_at: '2026-11-17T00:00:00Z', trend_at: '2026-11-17T00:00:00Z' }, NOW);
  assert.equal(d.toISOString(), '2026-01-01T00:00:00.000Z');
});

test('미래 값은 지금으로 자르고, 날짜가 하나도 없으면 생략', () => {
  assert.equal(gameLastmod({ last_updated: '2027-01-01' }, NOW).getTime(), NOW);
  assert.equal(gameLastmod({}, NOW), undefined);
  assert.equal(gameLastmod({ created_at: 'x', price_history: [{ checked_at: null }] }, NOW), undefined);
});

test('같은 데이터면 몇 번을 불러도 같은 값 (현재 시각에 따라 안 변함)', () => {
  const g = { created_at: '2026-01-01T00:00:00Z' };
  assert.equal(gameLastmod(g, NOW).getTime(), gameLastmod(g, NOW + 86400000 * 30).getTime());
});
