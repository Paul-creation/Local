// 실행: npm test — GetItems 리뷰 요약 읽기 (appreviews 대체 경로)
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseGetItems, fetchGetItemsReviews, fetchGetItemsReviewsWithKr, parseUnavailable, getItemsUrl } from './review-getitems.mjs';
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

// ── 미국 스토어 조회 불가(success 15) → 한국 기준 재시도
const itemsOf = (url) => JSON.parse(decodeURIComponent(url.split('input_json=')[1]));
const ccOf = (url) => itemsOf(url).context.country_code;
const appidsOf = (url) => itemsOf(url).ids.map((x) => x.appid);

test('getItemsUrl: 나라 코드를 바꿀 수 있고 기본은 US', () => {
  assert.equal(ccOf(getItemsUrl(['1'])), 'US');
  assert.equal(ccOf(getItemsUrl(['1'], 'KR')), 'KR');
});

test('parseUnavailable: success 15인 appid만', () => {
  assert.deepEqual(parseUnavailable({ response: { store_items: [item(1, S), item(2, null, 15), item(3, null, 2), { id: 4, success: 15 }] } }), ['2', '4']);
  assert.deepEqual(parseUnavailable(null), []);
});

test('US에서 다 받으면 KR 호출 없음', async () => {
  const calls = [];
  const get = async (url) => { calls.push(ccOf(url)); return { response: { store_items: appidsOf(url).map((a) => item(a, S)) } }; };
  const r = await fetchGetItemsReviewsWithKr([1, 2, 3], { get });
  assert.deepEqual(calls, ['US']);
  assert.equal(r.reviews.size, 3);
  assert.equal(r.krRetried, 0);
  assert.equal(r.krRecovered, 0);
});

test('success 15인 appid만 KR로 다시 부르고, 받으면 값에 넣음', async () => {
  const KR = { review_count: 100, percent_positive: 91, review_score: 9, review_score_label: 'Very Positive' };
  const calls = [];
  const get = async (url) => {
    const cc = ccOf(url), ids = appidsOf(url);
    calls.push([cc, ids]);
    return { response: { store_items: ids.map((a) => (cc === 'US' ? (a === 2 || a === 4 ? item(a, null, 15) : item(a, S)) : item(a, KR))) } };
  };
  const r = await fetchGetItemsReviewsWithKr([1, 2, 3, 4], { get });
  assert.deepEqual(calls, [['US', [1, 2, 3, 4]], ['KR', [2, 4]]]);
  assert.equal(r.reviews.get('1').total_reviews, S.review_count); // US 값은 그대로
  assert.equal(r.reviews.get('2').total_reviews, 100); // KR 값
  assert.equal(r.reviews.get('4').positive_percent, 91);
  assert.equal(r.krRetried, 2);
  assert.equal(r.krRecovered, 2);
});

test('KR도 실패(조회 불가·리뷰 없음·요청 오류)하면 값 없음 → 기존 값 유지·실패로 셈', async () => {
  const get = async (url) => {
    const cc = ccOf(url), ids = appidsOf(url);
    if (cc === 'US') return { response: { store_items: ids.map((a) => item(a, null, 15)) } };
    return { response: { store_items: [item(ids[0], null, 15), item(ids[1], { ...S, review_count: 0 })] } };
  };
  const r = await fetchGetItemsReviewsWithKr([7, 8], { get });
  assert.equal(r.reviews.size, 0);
  assert.equal(r.krRetried, 2);
  assert.equal(r.krRecovered, 0);
  const getThrow = async (url) => { if (ccOf(url) === 'KR') throw new Error('막힘'); return { response: { store_items: appidsOf(url).map((a) => item(a, null, 15)) } }; };
  const r2 = await fetchGetItemsReviewsWithKr([7], { get: getThrow });
  assert.equal(r2.reviews.size, 0);
  assert.equal(r2.krRetried, 1);
});

test('KR 응답에서 요청하지 않은 appid(다른 번호로 돌아온 응답)는 받아들이지 않음', async () => {
  const get = async (url) => {
    if (ccOf(url) === 'US') return { response: { store_items: [item(201270, null, 15)] } };
    return { response: { store_items: [item(34330, S)] } }; // 201270을 물었는데 34330이 돌아옴
  };
  const r = await fetchGetItemsReviewsWithKr([201270], { get });
  assert.equal(r.reviews.size, 0);
  assert.equal(r.krRecovered, 0);
});

test('US 요청 자체가 실패한 묶음은 KR 재시도 대상이 아님, 나머지 묶음은 이어감', async () => {
  const calls = [];
  const get = async (url) => {
    const cc = ccOf(url), ids = appidsOf(url);
    calls.push(cc);
    if (cc === 'US' && ids[0] === 1) throw new Error('막힘');
    return { response: { store_items: ids.map((a) => item(a, cc === 'US' ? null : S, cc === 'US' ? 15 : 1)) } };
  };
  const r = await fetchGetItemsReviewsWithKr([1, 2, 3, 4], { get, chunk: 2 });
  assert.deepEqual(calls, ['US', 'US', 'KR']);
  assert.deepEqual([...r.reviews.keys()].sort(), ['3', '4']);
  assert.equal(r.krRetried, 2);
});
