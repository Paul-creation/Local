// 실행: npm test — 할인 종료 표시 규칙 (24시간 경계·지난 종료일·null)과 역대 최저가 게이지 숨김 조건
import test from 'node:test';
import assert from 'node:assert/strict';
import { saleEndsLabel, saleEndsDetail, lowestGauge } from './saleEnds.ts';
import { getPriceInfo, flattenGame } from './price.ts';

// now = 2026-10-12 22:00 KST (= 13:00Z)
const NOW = Date.parse('2026-10-12T13:00:00Z');
const kst = (s) => new Date(Date.parse(s + '+09:00')).toISOString();

test('24시간보다 멀면 "10/14 02:00까지" (기본색)', () => {
  assert.deepEqual(saleEndsLabel(kst('2026-10-14T02:00:00'), NOW), { text: '10/14 02:00까지', soon: false });
  assert.deepEqual(saleEndsLabel(kst('2026-11-03T09:05:00'), NOW), { text: '11/3 09:05까지', soon: false });
});

test('24시간 안: 같은 날이면 "오늘", 다음 날이면 "내일" (--sale)', () => {
  assert.deepEqual(saleEndsLabel(kst('2026-10-12T23:30:00'), NOW), { text: '오늘 23:30까지', soon: true });
  assert.deepEqual(saleEndsLabel(kst('2026-10-13T02:00:00'), NOW), { text: '내일 02:00까지', soon: true });
});

test('24시간 경계: 정확히 24시간은 내일(soon), 1초 넘으면 날짜 표기', () => {
  assert.deepEqual(saleEndsLabel(kst('2026-10-13T22:00:00'), NOW), { text: '내일 22:00까지', soon: true });
  assert.deepEqual(saleEndsLabel(kst('2026-10-13T22:00:01'), NOW), { text: '10/13 22:00까지', soon: false });
});

test('null·잘못된 값·이미 지났거나 지금이면 표시 없음', () => {
  assert.equal(saleEndsLabel(null, NOW), null);
  assert.equal(saleEndsLabel(undefined, NOW), null);
  assert.equal(saleEndsLabel('not-a-date', NOW), null);
  assert.equal(saleEndsLabel(kst('2026-10-12T21:59:59'), NOW), null);
  assert.equal(saleEndsLabel(new Date(NOW).toISOString(), NOW), null);
  assert.equal(saleEndsDetail(kst('2026-10-12T21:00:00'), NOW), null);
  assert.equal(saleEndsDetail(null, NOW), null);
});

test('KST 날짜로 계산 (UTC 날짜와 달라도)', () => {
  // 2026-10-13 02:00 KST = 2026-10-12T17:00Z, UTC로는 같은 날이지만 KST로는 내일
  assert.equal(saleEndsLabel('2026-10-12T17:00:00Z', NOW).text, '내일 02:00까지');
});

test('상세: "할인 종료 10/14(수) 02:00" 요일 포함', () => {
  assert.deepEqual(saleEndsDetail(kst('2026-10-14T02:00:00'), NOW), { text: '할인 종료 10/14(수) 02:00', soon: false });
  assert.equal(saleEndsDetail(kst('2026-10-13T02:00:00'), NOW).soon, true);
});

test('게이지: 정가 0% → 역대 최저가 100%', () => {
  const g = lowestGauge(26000, 17000, 8000); // (26000-17000)/(26000-8000)=50%
  assert.equal(g.percent, 50);
  assert.equal(g.remaining, 9000);
  assert.equal(g.atLowest, false);
  assert.equal(lowestGauge(26000, 26000, 8000).percent, 0);
});

test('게이지: 이미 역대 최저가면 꽉 채움', () => {
  assert.deepEqual(lowestGauge(26000, 8580, 8580), { percent: 100, remaining: 0, atLowest: true });
});

test('게이지 숨김: 숫자가 없거나, 최저가≥정가, 현재가<최저가, 현재가>정가', () => {
  assert.equal(lowestGauge(null, 5000, 3000), null);
  assert.equal(lowestGauge(10000, null, 3000), null);
  assert.equal(lowestGauge(10000, 5000, null), null);
  assert.equal(lowestGauge(10000, 10000, 10000), null); // 최저가 = 정가 (할인 이력 없음)
  assert.equal(lowestGauge(10000, 5000, 12000), null);  // 최저가 > 정가
  assert.equal(lowestGauge(10000, 2000, 3000), null);   // 현재가 < 최저가
  assert.equal(lowestGauge(10000, 12000, 3000), null);  // 현재가 > 정가
  assert.equal(lowestGauge(10000, 5000, 50), null);     // 100원 미만은 달러 값
});

test('price: sale_ends_at은 할인 중일 때만 saleEndsAt으로, 평탄화에도 실림', () => {
  const row = (discount, ends) => ({ price: 5000, discount_percent: discount, original_price: 10000, sale_ends_at: ends, checked_at: '2026-10-12T00:00:00Z' });
  assert.equal(getPriceInfo({ price_history: [row(50, '2026-10-14T00:00:00Z')] }).saleEndsAt, '2026-10-14T00:00:00Z');
  assert.equal(getPriceInfo({ price_history: [row(50, null)] }).saleEndsAt, null);
  assert.equal(getPriceInfo({ price_history: [row(0, '2026-10-14T00:00:00Z')] }).saleEndsAt, null);
  const flat = flattenGame({ id: 'a', price_history: [row(50, '2026-10-14T00:00:00Z')] });
  assert.equal(flat.price_sale_ends, '2026-10-14T00:00:00Z');
  assert.equal(getPriceInfo(flat).saleEndsAt, '2026-10-14T00:00:00Z');
  assert.equal('price_sale_ends' in flattenGame({ id: 'b', price_history: [row(50, null)] }), false);
});

test('price.regular: 저장된 정가만 (할인 없어도 저장돼 있으면), 없으면 null', () => {
  assert.equal(getPriceInfo({ price_history: [{ price: 5000, discount_percent: 0, original_price: 5000, checked_at: '2026-10-12T00:00:00Z' }] }).regular, 5000);
  assert.equal(getPriceInfo({ price_history: [{ price: 5000, discount_percent: 0, original_price: null, checked_at: '2026-10-12T00:00:00Z' }] }).regular, null);
});
