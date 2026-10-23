// 실행: npm test — 큐레이터 경로의 리뷰 조회 실패 건너뛰기
import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchReviewSummary, reviewsUrl } from './review-fetch.mjs';
import { steamGet, SteamLimitError } from './steam.mjs';

test('큐레이터: 조회가 실패하면 재시도 없이 null', async () => {
  const opts = [];
  const get = async (url, o) => { opts.push(o); throw new SteamLimitError('막힘'); };
  assert.equal(await fetchReviewSummary('1', { curator: true, get }), null);
  assert.deepEqual(opts, [{ waits: [] }]); // 재시도 대기 목록이 비어 있어야 함
});

test('큐레이터: 성공하면 query_summary', async () => {
  const get = async () => ({ query_summary: { total_reviews: 5 } });
  assert.deepEqual(await fetchReviewSummary('1', { curator: true, get }), { total_reviews: 5 });
});

test('일반 경로: 실패하면 그대로 던지고 재시도 옵션도 안 줌', async () => {
  const opts = [];
  const get = async (url, o) => { opts.push(o); throw new SteamLimitError('막힘'); };
  await assert.rejects(fetchReviewSummary('1', { get }), SteamLimitError);
  assert.deepEqual(opts, [undefined]);
});

test('큐레이터: 실제 steamGet이 302→HTML을 받아도 첫 시도만 하고 null', async () => {
  const real = globalThis.fetch;
  let n = 0;
  globalThis.fetch = async () => { n++; return new Response('<html>store</html>', { status: 200 }); };
  try {
    const get = (url, o) => steamGet(url, { ...o, gapMs: 0 });
    assert.equal(await fetchReviewSummary('582500', { curator: true, get }), null);
    assert.equal(n, 1);
  } finally { globalThis.fetch = real; }
});

test('reviewsUrl 형식', () => {
  assert.match(reviewsUrl('582500'), /appreviews\/582500\?json=1&filter=summary/);
});
