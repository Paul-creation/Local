// 실행: npm test — 계정 프로필 페이지 묶기·날짜·필터·정렬
import test from 'node:test';
import assert from 'node:assert/strict';
import { groupByPost, groupByGame, dateLabel, filterSortEntries } from './curatorView.ts';

const vis = new Map([['g1', '게임1'], ['g2', '게임2'], ['g3', '게임3']]);
const P = (id, game_id, post_url, posted_at, extra = {}) => ({ id, game_id, post_url, post_type: 'single', posted_at, ...extra });

test('게시물별: 최신순, 제목은 post_title → 게임 이름 → 모음', () => {
  const posts = [P('a', 'g1', 'u1', '2026-10-04T00:00:00Z'), P('b', 'g2', 'u2', '2026-10-03T00:00:00Z'), P('c', 'g3', 'u2', '2026-10-03T00:00:00Z'), P('d', 'g1', 'u3', '2026-09-01T00:00:00Z', { post_title: '협동 추천' })];
  const s = groupByPost(posts, vis);
  assert.deepEqual(s.map((x) => [x.key, x.title, x.gameIds.length]), [['u1', '게임1', 1], ['u2', '게임 2개 모음', 2], ['u3', '협동 추천', 1]]);
});

test('보이지 않는 게임만 있는 게시물은 빠진다', () => {
  assert.equal(groupByPost([P('a', 'zz', 'u1', '2026-10-04T00:00:00Z')], vis).length, 0);
});

test('게임별: 게시물이 여러 개면 링크 여러 개, 최신 게시물 순', () => {
  const e = groupByGame([P('a', 'g1', 'u1', '2026-10-04T00:00:00Z'), P('b', 'g2', 'u2', '2026-10-03T00:00:00Z'), P('c', 'g2', 'u3', '2026-09-01T00:00:00Z')], vis);
  assert.deepEqual(e.map((x) => [x.gameId, x.posts.length]), [['g1', 1], ['g2', 2]]);
});

test('날짜: 올해는 월·일만, 다른 해는 연도 포함, 한국 시간 기준', () => {
  const now = new Date('2026-10-24T00:00:00Z');
  assert.equal(dateLabel('2026-10-04T00:00:00Z', now), '10월 4일');
  assert.equal(dateLabel('2026-10-03T16:00:00Z', now), '10월 4일');
  assert.equal(dateLabel('2025-10-04T00:00:00Z', now), '2025년 10월 4일');
});

test('필터 겹치기·정렬', () => {
  const f = { g1: { discount: 0, multi: true, soon: false, reviewPercent: 90, reviewTotal: 10 }, g2: { discount: 50, multi: true, soon: false, reviewPercent: 80, reviewTotal: 5 }, g3: { discount: 70, multi: false, soon: true, reviewPercent: 0, reviewTotal: 0 } };
  const e = ['g1', 'g2', 'g3'].map((gameId) => ({ gameId, postedAt: '', posts: [] }));
  const facts = (x) => f[x.gameId];
  assert.deepEqual(filterSortEntries(e, facts, ['sale', 'multi'], 'recent').map((x) => x.gameId), ['g2']);
  assert.deepEqual(filterSortEntries(e, facts, [], 'discount').map((x) => x.gameId), ['g3', 'g2', 'g1']);
  assert.deepEqual(filterSortEntries(e, facts, [], 'review').map((x) => x.gameId), ['g1', 'g2', 'g3']);
});
