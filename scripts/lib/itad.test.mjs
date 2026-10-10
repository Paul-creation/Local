// 실행: npm test — itad: 요청 타임아웃·연결 실패 시 재시도, 재시도 소진 시 ItadLimitError / enrich-itad-heat: 배치마다 저장
process.env.ITAD_API_KEY ??= 'test-key';
const { default: test } = await import('node:test');
const { default: assert } = await import('node:assert/strict');
const { itadGet, itadTuning, ItadLimitError } = await import('./itad.mjs');
const { processHeatBatches } = await import('./itad-heat-batch.mjs');

const logs = [];
Object.assign(itadTuning, { gapMs: 0, timeoutMs: 20, backoffMs: 1, log: (m) => logs.push(m) });
const realFetch = globalThis.fetch;
const hang = (_url, { signal }) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(signal.reason)));
const ok = (json) => async () => ({ ok: true, status: 200, json: async () => json });

test('itadGet: 타임아웃 나면 다시 시도해서 성공', async (t) => {
  let calls = 0;
  t.after(() => { globalThis.fetch = realFetch; });
  globalThis.fetch = (url, init) => (++calls < 3 ? hang(url, init) : ok({ a: 1 })());
  assert.deepEqual(await itadGet('/x', {}), { a: 1 });
  assert.equal(calls, 3);
});

test('itadGet: 계속 무응답이면 4번 시도 뒤 ItadLimitError', async (t) => {
  let calls = 0;
  t.after(() => { globalThis.fetch = realFetch; });
  globalThis.fetch = (url, init) => { calls++; return hang(url, init); };
  await assert.rejects(() => itadGet('/x', {}), ItadLimitError);
  assert.equal(calls, 4);
});

test('itadGet: 연결 실패도 다시 시도, 404는 바로 오류', async (t) => {
  let calls = 0;
  t.after(() => { globalThis.fetch = realFetch; });
  globalThis.fetch = async () => { if (++calls === 1) throw new Error('reset'); return { ok: false, status: 404, headers: new Headers() }; };
  await assert.rejects(() => itadGet('/x', {}), /ITAD 응답 404/);
  assert.equal(calls, 2);
});

const res429 = (sec) => ({ ok: false, status: 429, headers: new Headers({ 'retry-after': String(sec) }) });

test('itadGet: 429 retry-after가 60초 이하면 기다렸다 재시도하고 대기 로그를 남김', async (t) => {
  let calls = 0;
  logs.length = 0;
  t.after(() => { globalThis.fetch = realFetch; });
  globalThis.fetch = async () => (++calls === 1 ? res429(1) : { ok: true, status: 200, json: async () => ({ a: 1 }) });
  const t0 = Date.now();
  assert.deepEqual(await itadGet('/x', {}), { a: 1 });
  assert.equal(calls, 2);
  assert.ok(Date.now() - t0 >= 900, '1초 기다림');
  assert.deepEqual(logs, ['ITAD 429 대기 1초 (재시도 1/3)']);
});

test('itadGet: 429 retry-after가 60초 초과면 기다리지 않고 바로 ItadLimitError', async (t) => {
  let calls = 0;
  logs.length = 0;
  t.after(() => { globalThis.fetch = realFetch; });
  globalThis.fetch = async () => { calls++; return res429(61); };
  const t0 = Date.now();
  await assert.rejects(() => itadGet('/x', {}), ItadLimitError);
  assert.equal(calls, 1);
  assert.ok(Date.now() - t0 < 500);
  assert.deepEqual(logs, []);
});

test('itadGet: 60초 딱 맞으면 대기 대상 (상한은 초과일 때만)', async (t) => {
  logs.length = 0;
  t.after(() => { globalThis.fetch = realFetch; Object.assign(itadTuning, { maxRetryAfterSec: 60 }); });
  Object.assign(itadTuning, { maxRetryAfterSec: 1 });
  let calls = 0;
  globalThis.fetch = async () => (++calls === 1 ? res429(1) : { ok: true, status: 200, json: async () => ({}) });
  await itadGet('/x', {});
  assert.equal(calls, 2);
});

test('itadGet: 타임아웃 재시도마다 대기 로그', async (t) => {
  logs.length = 0;
  let calls = 0;
  t.after(() => { globalThis.fetch = realFetch; });
  globalThis.fetch = (url, init) => (++calls < 3 ? hang(url, init) : ok({})());
  await itadGet('/x', {});
  assert.equal(logs.length, 2); // 테스트에서는 대기가 1~2ms라 초 단위는 0으로 반올림됨
  assert.match(logs[0], /^ITAD 타임아웃 대기 \d+초 \(재시도 1\/3\)$/);
  assert.match(logs[1], /^ITAD 타임아웃 대기 \d+초 \(재시도 2\/3\)$/);
});

const games = (n) => Array.from({ length: n }, (_, i) => ({ id: `g${i}`, name: `G${i}` }));
const quiet = () => {};
const isLimitError = (e) => e instanceof ItadLimitError;

test('배치 저장: 둘째 배치에서 ITAD가 막혀도 첫 배치는 저장돼 있음', async () => {
  const savedIds = [];
  const r = await processHeatBatches({
    games: games(5), batchSize: 2, log: quiet, isLimitError,
    collect: async (g) => { if (g.id === 'g3') throw new ItadLimitError('막힘'); return { update: { heat_rank: 1 }, itadId: `i${g.id}` }; },
    getLows: async () => new Map(),
    save: async (g) => { savedIds.push(g.id); return true; },
  });
  assert.deepEqual(savedIds, ['g0', 'g1', 'g2']); // g2는 둘째 배치에서 막히기 전에 모은 것도 저장
  assert.equal(r.stopped, true);
  assert.equal(r.saved, 3);
  assert.equal(r.processed, 3); // g3에서 막힘 → 0~2까지 처리
});

test('배치 저장: 중단하면 "처리 N/전체" 로그', async () => {
  const lines = [];
  await processHeatBatches({
    games: games(5), batchSize: 2, log: (m) => lines.push(m), isLimitError,
    collect: async (g) => { if (g.id === 'g3') throw new ItadLimitError('ITAD 429 retry-after 90초'); return { update: { heat_rank: 1 }, itadId: g.id }; },
    getLows: async () => new Map(), save: async () => true,
  });
  assert.ok(lines.some((l) => l.startsWith('ITAD 요청 제한으로 중단, 처리 3/5')), lines.join('\n'));
});

test('배치 저장: 최저가 조회가 실패해도 그 배치의 순위는 저장하고 다음 배치로 진행', async () => {
  const saved = [];
  let lowCalls = 0;
  const r = await processHeatBatches({
    games: games(4), batchSize: 2, log: quiet, isLimitError,
    collect: async (g) => ({ update: { heat_rank: 1 }, itadId: `i${g.id}` }),
    getLows: async (ids) => { if (++lowCalls === 1) throw new Error('boom'); return new Map(ids.map((id) => [id, { price: 1000, date: 'd', shop: 's' }])); },
    save: async (g, u) => { saved.push([g.id, u.lowest_price ?? null]); return true; },
  });
  assert.deepEqual(saved, [['g0', null], ['g1', null], ['g2', 1000], ['g3', 1000]]);
  assert.equal(r.failed, 1);
  assert.equal(r.stopped, false);
});

test('배치 저장: 저장 실패는 세고 계속, ITAD에 없는 게임은 건너뜀', async () => {
  const r = await processHeatBatches({
    games: games(3), batchSize: 10, log: quiet, isLimitError,
    collect: async (g) => (g.id === 'g1' ? null : { update: { heat_rank: 1 }, itadId: g.id }),
    getLows: async () => new Map(),
    save: async (g) => g.id !== 'g0',
  });
  assert.deepEqual([r.saved, r.noMatch, r.failed], [1, 1, 1]);
});
