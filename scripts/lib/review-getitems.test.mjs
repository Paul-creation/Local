// 실행: npm test — GetItems 리뷰 요약 읽기 (appreviews 대체 경로)
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseGetItems, fetchGetItemsReviews, getItemsUrl } from './review-getitems.mjs';
import { buildReviewUpdate } from './review-fill.mjs';

const item = (appid, s, success = 1) => ({ appid, success, reviews: s ? { summary_filtered: s } : {} });
const S = { review_count: 33471, percent_positive: 89, review_score: 8, review_score_label: 'Very Positive' };

test('summary_filtered를 appid별로 읽음', () => {
  const m = parseGetItems({ response: { store_items: [item(582500, S)] } });
  assert.deepEqual(m.get('582500'), { total_reviews: 33471, positive_percent: 89, review_score_desc: 'Very Positive' });
});

test('리뷰 없음·개수 0·success 아님은 뺌', () => {
  const m = parseGetItems({ response: { store_items: [item(1, null), item(2, { ...S, review_count: 0 }), item(3, S, 2)] } });
  assert.equal(m.size, 0);
  assert.equal(parseGetItems(null).size, 0);
});

test('묶음으로 보내고, 실패한 묶음은 건너뜀', async () => {
  const calls = [];
  const get = async (url) => {
    calls.push(url);
    if (calls.length === 2) throw new Error('막힘');
    const ids = JSON.parse(decodeURIComponent(url.split('input_json=')[1])).ids.map((x) => x.appid);
    return { response: { store_items: ids.map((a) => item(a, S)) } };
  };
  const m = await fetchGetItemsReviews([1, 2, 3, 4, 5], { get, chunk: 2 });
  assert.equal(calls.length, 3);
  assert.deepEqual([...m.keys()].sort(), ['1', '2', '5']);
});

test('getItemsUrl: appid가 숫자로 들어감', () => {
  assert.match(decodeURIComponent(getItemsUrl(['730'])), /"ids":\[\{"appid":730\}\]/);
});

test('GetItems 값으로 업데이트: 3칸 + 출처', () => {
  const qs = parseGetItems({ response: { store_items: [item(582500, S)] } }).get('582500');
  assert.deepEqual(buildReviewUpdate({ review_summary: null, review_source: null }, qs, { source: 'getitems', hasSource: true }),
    { review_total: 33471, review_positive_percent: 89, review_summary: '매우 긍정적', review_source: 'getitems' });
});

test('appreviews가 돌아오면 getitems·store_page 출처 게임의 문구도 덮어씀, appreviews·빈 출처는 문구 유지', () => {
  const qs = { total_reviews: 200, total_positive: 190, review_score_desc: 'Overwhelmingly Positive' };
  const o = { source: 'appreviews', hasSource: true };
  assert.equal(buildReviewUpdate({ review_summary: '매우 긍정적', review_source: 'getitems' }, qs, o).review_summary, '압도적으로 긍정적');
  assert.equal(buildReviewUpdate({ review_summary: '매우 긍정적', review_source: 'store_page' }, qs, o).review_summary, '압도적으로 긍정적');
  assert.equal(buildReviewUpdate({ review_summary: '매우 긍정적', review_source: 'appreviews' }, qs, o).review_summary, undefined);
  assert.equal(buildReviewUpdate({ review_summary: '매우 긍정적', review_source: null }, qs, o).review_summary, undefined);
  assert.equal(buildReviewUpdate({ review_summary: null }, qs, { source: 'appreviews', hasSource: false }).review_source, undefined); // 칸이 없으면 출처를 안 씀
});
