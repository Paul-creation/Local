// 실행: npm test — 이번 주 할인 마감: 168시간 창, 옛 행 때문에 끝난 할인이 섞이지 않는지, 날짜 그룹·빈 마디
import test from 'node:test';
import assert from 'node:assert/strict';
import { endsWithinWindow, groupByDay, endTimeText } from './saleTimeline.ts';
import { getPriceInfo, flattenGame } from './price.ts';

// now = 2026-10-12 22:00 KST (= 13:00Z)
const NOW = Date.parse('2026-10-12T13:00:00Z');
const kst = (s) => new Date(Date.parse(s + '+09:00')).toISOString();
const item = (id, endsAt, discount = 30) => ({ id, endsAt: kst(endsAt), discount });

test('창: 지금 이후 ~ 168시간 이내, 할인 중일 때만', () => {
  assert.equal(endsWithinWindow(30, kst('2026-10-13T02:00:00'), NOW), true);
  assert.equal(endsWithinWindow(30, new Date(NOW + 168 * 3600_000).toISOString(), NOW), true);
  assert.equal(endsWithinWindow(30, new Date(NOW + 168 * 3600_000 + 1).toISOString(), NOW), false);
  assert.equal(endsWithinWindow(30, kst('2026-10-12T21:59:00'), NOW), false); // 이미 끝남
  assert.equal(endsWithinWindow(0, kst('2026-10-13T02:00:00'), NOW), false);  // 할인 아님
  assert.equal(endsWithinWindow(30, null, NOW), false);                       // 종료일 모름
  assert.equal(endsWithinWindow(30, 'not-a-date', NOW), false);
});

test('옛 행 때문에 끝난 할인이 섞이지 않음: 최신 행 기준으로 다시 거른다', () => {
  const old = { price: 7000, discount_percent: 30, checked_at: '2026-10-10T00:00:00Z', original_price: 10000, sale_ends_at: kst('2026-10-13T02:00:00') };
  // 최신 행은 할인이 끝나 정가 (옛 행에만 미래 종료일이 남음)
  const ended = { id: 'a', price_history: [old, { price: 10000, discount_percent: 0, checked_at: '2026-10-12T00:00:00Z', original_price: 10000, sale_ends_at: null }] };
  const p1 = getPriceInfo(flattenGame(ended));
  assert.equal(endsWithinWindow(p1.discount, p1.saleEndsAt, NOW), false);
  // 최신 행의 종료일이 이미 지남
  const past = { id: 'b', price_history: [{ ...old, checked_at: '2026-10-12T00:00:00Z', sale_ends_at: kst('2026-10-12T20:00:00') }] };
  const p2 = getPriceInfo(flattenGame(past));
  assert.equal(endsWithinWindow(p2.discount, p2.saleEndsAt, NOW), false);
  // 최신 행이 진행 중인 할인이면 통과
  const live = { id: 'c', price_history: [old, { ...old, checked_at: '2026-10-12T00:00:00Z' }] };
  const p3 = getPriceInfo(flattenGame(live));
  assert.equal(endsWithinWindow(p3.discount, p3.saleEndsAt, NOW), true);
});

test('날짜 마디: 오늘/내일/요일, 마감 순, 끝난 카드와 168시간 밖은 빠짐', () => {
  const groups = groupByDay([
    item('late', '2026-10-14T10:00:00'),
    item('today2', '2026-10-12T23:30:00'),
    item('today1', '2026-10-12T22:30:00'),
    item('tomorrow', '2026-10-13T02:00:00'),
    item('done', '2026-10-12T21:00:00'),
    item('far', '2026-10-20T10:00:00'),
    item('nodisc', '2026-10-13T05:00:00', 0),
  ], NOW);
  assert.deepEqual(groups.map((g) => g.heading), ['오늘 · 10/12(월)', '내일 · 10/13(화)', '10/14(수)']);
  assert.deepEqual(groups[0].items.map((i) => i.id), ['today1', 'today2']);
  assert.equal(groups[0].today, true);
  assert.equal(groups[1].today, false);
});

test('시간이 흘러 마디가 비면 그 마디는 사라지고, 전부 비면 빈 배열', () => {
  const items = [item('a', '2026-10-12T23:00:00'), item('b', '2026-10-13T02:00:00')];
  const later = Date.parse('2026-10-12T23:30:00+09:00');
  assert.deepEqual(groupByDay(items, later).map((g) => g.heading), ['내일 · 10/13(화)']); // 오늘 마디는 비어서 사라짐
  assert.deepEqual(groupByDay(items, later).flatMap((g) => g.items.map((i) => i.id)), ['b']);
  assert.deepEqual(groupByDay(items, Date.parse('2026-10-13T03:00:00+09:00')), []);
});

test('시각 표기', () => {
  assert.equal(endTimeText(kst('2026-10-14T02:00:00')), '02:00까지');
  assert.equal(endTimeText(kst('2026-10-14T23:05:00')), '23:05까지');
});
