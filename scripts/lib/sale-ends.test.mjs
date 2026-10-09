// 실행: npm test — sale-ends: 할인 종료일 저장 (있음·없음·끝남·ITAD 오류일 때 기존 값 유지)
import test from 'node:test';
import assert from 'node:assert/strict';
import { processSaleEnds, ITAD_BATCH } from './sale-ends.mjs';

const NOW = Date.parse('2026-10-10T00:00:00Z');
const quiet = () => {};
function fakeDb() {
  const calls = [];
  return {
    calls,
    from: () => ({
      update: (row) => ({
        eq: (_, id) => { calls.push({ id, ...row }); return Promise.resolve({ error: null }); },
        in: (_, ids) => { calls.push({ ids, ...row }); return Promise.resolve({ error: null }); },
      }),
    }),
  };
}
const game = (n, ph) => ({ id: `g${n}`, name: `Game ${n}`, itad_id: `itad${n}`, price_history: ph });
const sale = (id, extra = {}) => ({ id, price: 5000, discount_percent: 50, checked_at: '2026-10-09T00:00:00Z', sale_ends_at: null, ...extra });
const deal = (n, expiry, extra = {}) => ({ id: `itad${n}`, deals: [{ shop: { id: 61 }, price: { amount: 5000 }, cut: 50, expiry, ...extra }] });

test('종료일이 있으면 최신 행에 저장 (UTC)', async () => {
  const db = fakeDb();
  const r = await processSaleEnds({ supabase: db, games: [game(1, [sale('p1')])], getDeals: async () => [deal(1, '2026-10-12T19:00:00+02:00')], now: NOW, log: quiet });
  assert.deepEqual(db.calls, [{ id: 'p1', sale_ends_at: '2026-10-12T17:00:00.000Z' }]);
  assert.equal(r.set, 1);
});

test('종료일을 모르면 null로 두고 추정하지 않음', async () => {
  const db = fakeDb();
  const r = await processSaleEnds({ supabase: db, games: [game(1, [sale('p1')])], getDeals: async () => [deal(1, null)], now: NOW, log: quiet });
  assert.deepEqual(db.calls, []); // 이미 null이라 저장할 것이 없음
  assert.equal(r.noInfo, 1);
  // 예전에 값이 있었는데 이번엔 모르면 비움
  const db2 = fakeDb();
  await processSaleEnds({ supabase: db2, games: [game(1, [sale('p1', { sale_ends_at: '2026-10-12T00:00:00Z' })])], getDeals: async () => [deal(1, null)], now: NOW, log: quiet });
  assert.deepEqual(db2.calls, [{ id: 'p1', sale_ends_at: null }]);
});

test('할인이 끝남: ITAD에 스팀 딜이 없거나 종료 시각이 지났으면 비움', async () => {
  const old = '2026-10-12T00:00:00Z';
  const db = fakeDb();
  const r = await processSaleEnds({
    supabase: db,
    games: [game(1, [sale('p1', { sale_ends_at: old })]), game(2, [sale('p2', { sale_ends_at: old })])],
    getDeals: async () => [deal(2, '2026-10-09T00:00:00Z')], // 1번은 응답에 없음, 2번은 이미 지남
    now: NOW, log: quiet,
  });
  assert.deepEqual(db.calls.map((c) => [c.id, c.sale_ends_at]), [['p1', null], ['p2', null]]);
  assert.equal(r.cleared, 2);
});

test('할인 중이 아닌 게임·최신이 아닌 행의 종료일은 비우고, ITAD는 부르지 않음', async () => {
  const db = fakeDb();
  let called = 0;
  const g = game(1, [
    { id: 'old', price: 5000, discount_percent: 50, checked_at: '2026-10-01T00:00:00Z', sale_ends_at: '2026-10-05T00:00:00Z' },
    { id: 'new', price: 10000, discount_percent: 0, checked_at: '2026-10-06T00:00:00Z', sale_ends_at: null },
  ]);
  const r = await processSaleEnds({ supabase: db, games: [g], getDeals: async () => { called++; return []; }, now: NOW, log: quiet });
  assert.deepEqual(db.calls, [{ ids: ['old'], sale_ends_at: null }]);
  assert.equal(called, 0);
  assert.equal(r.requests, 0);
});

test('ITAD 오류면 기존 값을 지우지 않음', async () => {
  const db = fakeDb();
  const g = game(1, [sale('p1', { sale_ends_at: '2026-10-12T00:00:00Z' })]);
  const r = await processSaleEnds({ supabase: db, games: [g], getDeals: async () => { throw new Error('ITAD 응답 429'); }, now: NOW, log: quiet });
  assert.deepEqual(db.calls, []);
  assert.equal(r.errors, 1);
});

test('딜 가격이 최신 기록과 다르면 건드리지 않음', async () => {
  const db = fakeDb();
  const g = game(1, [sale('p1', { sale_ends_at: '2026-10-12T00:00:00Z' })]);
  const r = await processSaleEnds({ supabase: db, games: [g], getDeals: async () => [deal(1, '2026-10-20T00:00:00Z', { price: { amount: 4000 } })], now: NOW, log: quiet });
  assert.deepEqual(db.calls, []);
  assert.equal(r.mismatch, 1);
});

test('200개씩 나눠 요청하고, 한 묶음이 오류여도 다른 묶음은 처리', async () => {
  const db = fakeDb();
  const games = Array.from({ length: ITAD_BATCH + 1 }, (_, i) => game(i, [sale(`p${i}`)]));
  let n = 0;
  const r = await processSaleEnds({ supabase: db, games, getDeals: async (ids) => { n++; if (n === 1) throw new Error('boom'); return ids.map((id) => deal(id.slice(4), '2026-10-12T00:00:00Z')); }, now: NOW, log: quiet });
  assert.equal(r.requests, 2);
  assert.equal(r.errors, 1);
  assert.equal(r.set, 1);
});
