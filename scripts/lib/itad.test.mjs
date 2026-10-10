// 실행: npm test — itad: 요청 타임아웃·연결 실패 시 재시도, 재시도 소진 시 ItadLimitError / enrich-itad-heat: 배치마다 저장
process.env.ITAD_API_KEY ??= 'test-key';
const { default: test } = await import('node:test');
const { default: assert } = await import('node:assert/strict');
const { itadGet, itadTuning, ItadLimitError } = await import('./itad.mjs');
const { processHeatBatches } = await import('./itad-heat-batch.mjs');

Object.assign(itadTuning, { gapMs: 0, timeoutMs: 20, backoffMs: 1 });
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
