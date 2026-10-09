// 실행: npm test — fix-missing-prices: 스팀 요청 제한 처리 (연속 3번이면 멈춤, 실패로 기록하지 않음)
import test from 'node:test';
import assert from 'node:assert/strict';
import { processPrices, BATCH, MAX_CONSECUTIVE_LIMITED } from '../fix-missing-prices.mjs';
import { SteamLimitError } from './steam.mjs';

const games = (n) => Array.from({ length: n }, (_, i) => ({ id: `g${i}`, name: `Game ${i}`, steam_appid: String(1000 + i), price_history: [] }));
const ok = (batch) => Object.fromEntries(batch.map((g) => [g.steam_appid, { success: true, data: { price_overview: { currency: 'KRW', final: 1000000, initial: 1000000, discount_percent: 0 } } }]));

// Supabase 가짜: 저장 호출만 기록하고 항상 성공
function fakeDb() {
  const calls = { insert: [], update: [] };
  const chain = (result) => new Proxy({}, { get: (_, k) => (k === 'then' ? (res) => res(result) : () => chain(result)) });
  return {
    calls,
    from: () => ({
      insert: (row) => { calls.insert.push(row); return Promise.resolve({ error: null }); },
      update: (row) => { calls.update.push(row); return chain({ data: [{ id: 'x' }], error: null }); },
    }),
  };
}
const quiet = () => {};
const limit = () => { throw new SteamLimitError('스팀 응답 429 (3번 재시도 후)'); };

test('배치가 3번 연속 요청 제한이면 멈추고, 남은 게임까지 실패가 아니라 미처리로 셈', async () => {
  const db = fakeDb();
  const paid = games(BATCH * 6); // 배치 6개
  let calls = 0;
  const r = await processPrices({ supabase: db, paid, getBatch: async () => { calls++; return limit(); }, log: quiet });
  assert.equal(MAX_CONSECUTIVE_LIMITED, 3);
  assert.equal(calls, 3); // 4번째부터는 시도하지 않음
  assert.equal(r.unprocessed, BATCH * 6);
  assert.deepEqual(r.failed, []); // 실패로 기록하지 않음 → price_check_failed_since가 안 쌓임
  assert.deepEqual(r.okIds, []);
  assert.equal(db.calls.insert.length + db.calls.update.length, 0);
});

test('제한 사이에 성공이 끼면 연속이 끊겨서 계속 진행', async () => {
  const db = fakeDb();
  const paid = games(BATCH * 5);
  const plan = ['limit', 'limit', 'ok', 'limit', 'ok']; // 최대 연속 2번
  let i = 0;
  const r = await processPrices({ supabase: db, paid, getBatch: async (b) => (plan[i++] === 'limit' ? limit() : ok(b)), log: quiet });
  assert.equal(i, 5); // 5배치 모두 시도
  assert.equal(r.unprocessed, BATCH * 3);
  assert.equal(r.okIds.length, BATCH * 2);
  assert.deepEqual(r.failed, []);
  assert.equal(db.calls.insert.length, BATCH * 2); // 성공한 배치는 저장됨
});

test('마지막 배치들에서 3번 연속이면 남은 게임 수가 0이어도 정상 종료', async () => {
  const paid = games(BATCH * 4);
  const plan = ['ok', 'limit', 'limit', 'limit'];
  let i = 0;
  const r = await processPrices({ supabase: fakeDb(), paid, getBatch: async (b) => (plan[i++] === 'limit' ? limit() : ok(b)), log: quiet });
  assert.equal(r.unprocessed, BATCH * 3);
  assert.equal(r.okIds.length, BATCH);
});

test('요청 제한이 아닌 오류는 예전처럼 그 배치 전체를 실패로 기록', async () => {
  const paid = games(BATCH);
  const r = await processPrices({ supabase: fakeDb(), paid, getBatch: async () => { throw new Error('스팀 응답 404'); }, log: quiet });
  assert.equal(r.unprocessed, 0);
  assert.equal(r.failed.length, BATCH);
  assert.match(r.failed[0].note, /요청 실패/);
});

test('응답은 왔는데 그 게임 칸이 없으면 예전처럼 "상점 정보 없음" 실패 (제한이 아님)', async () => {
  const paid = games(3);
  const r = await processPrices({ supabase: fakeDb(), paid, getBatch: async (b) => ok(b.slice(0, 2)), log: quiet });
  assert.equal(r.okIds.length, 2);
  assert.equal(r.failed.length, 1);
  assert.match(r.failed[0].note, /상점 정보 없음/);
});

test('제한 없이 모두 성공하면 미처리 0', async () => {
  const paid = games(BATCH + 7);
  const r = await processPrices({ supabase: fakeDb(), paid, getBatch: async (b) => ok(b), log: quiet });
  assert.equal(r.unprocessed, 0);
  assert.equal(r.okIds.length, BATCH + 7);
});
