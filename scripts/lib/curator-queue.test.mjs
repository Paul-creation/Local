// 실행: npm test — 큐레이터 게임 추가 대기열 처리
import test from 'node:test';
import assert from 'node:assert/strict';
import { pendingRows, buildLinks, queueLine, RETRY_DAYS } from './curator-queue.mjs';

const NOW = Date.parse('2026-10-31T00:00:00Z');
const day = (n) => new Date(NOW - n * 86400000).toISOString();
const row = (o) => ({ id: 'r', appid: '100', curator_id: 'c1', post_url: 'https://www.instagram.com/p/AAAAA/', post_type: 'single', post_title: null, posted_at: day(1), created_at: day(1), imported_at: null, ...o });

test('대기 행: 가져온 것과 14일 지난 것은 뺀다', () => {
  const rows = [row({ id: 'a' }), row({ id: 'b', imported_at: day(0) }), row({ id: 'c', created_at: day(RETRY_DAYS + 1) }), row({ id: 'd', created_at: day(RETRY_DAYS - 1) })];
  assert.deepEqual(pendingRows(rows, NOW).map((r) => r.id), ['a', 'd']);
});

test('게임이 DB에 들어온 행만 연결하고 나머지는 남긴다', () => {
  const rows = [row({ id: 'a', appid: '100' }), row({ id: 'b', appid: '200' })];
  const { posts, doneIds, left } = buildLinks(rows, new Map([['100', 'g1']]));
  assert.deepEqual(doneIds, ['a']);
  assert.deepEqual(left.map((r) => r.id), ['b']);
  assert.equal(posts.length, 1);
  assert.deepEqual(posts[0], { curator_id: 'c1', game_id: 'g1', post_url: 'https://www.instagram.com/p/AAAAA/', post_type: 'single', post_title: null, posted_at: day(1) });
});

test('같은 게시물에 달린 여러 게임은 저장된 종류·제목·날짜 그대로 연결', () => {
  const m = { post_type: 'collection', post_title: '10월 모음', posted_at: day(3) };
  const { posts } = buildLinks([row({ id: 'a', appid: '1', ...m }), row({ id: 'b', appid: '2', ...m })], new Map([['1', 'g1'], ['2', 'g2']]));
  assert.deepEqual(posts.map((p) => [p.game_id, p.post_type, p.post_title]), [['g1', 'collection', '10월 모음'], ['g2', 'collection', '10월 모음']]);
  assert.equal(posts[0].posted_at, day(3));
});

test('같은 (계정, 게임, 게시물) 중복은 한 번만, 행은 모두 가져온 것으로 표시', () => {
  const { posts, doneIds } = buildLinks([row({ id: 'a', appid: '1' }), row({ id: 'b', appid: '1' })], new Map([['1', 'g1']]));
  assert.equal(posts.length, 1);
  assert.deepEqual(doneIds, ['a', 'b']);
});

test('종류·날짜가 비어 있는 예전 행은 단일·만든 날로', () => {
  const { posts } = buildLinks([row({ post_type: null, posted_at: null })], new Map([['100', 'g1']]));
  assert.equal(posts[0].post_type, 'single');
  assert.equal(posts[0].posted_at, day(1));
});

test('일일 요약 줄: 아무 일도 없으면 빈 문자열', () => {
  assert.equal(queueLine(null), '');
  assert.equal(queueLine({ added: 0, linked: 0, left: 0 }), '');
  assert.match(queueLine({ added: 2, linked: 3, left: 0 }), /큐레이터 게임 추가 2개 \(게시물 연결 3개\)/);
  assert.match(queueLine({ added: 0, linked: 0, left: 1 }), /대기 중 1개/);
});
