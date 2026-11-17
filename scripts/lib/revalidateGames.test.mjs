// 실행: npm test — 바뀐 게임 id 모으기·상세 페이지 갱신 호출 (바뀐 게 없으면 호출 안 함, 500개씩 나눔, 키는 로그에 안 찍음)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { recordChangedGames, flushChangedGames, MAX_IDS_PER_CALL } from './revalidateGames.mjs';
import { processPrices } from '../fix-missing-prices.mjs';

const tmp = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'rg-')), 'ids.json');
const env = { ADMIN_REVALIDATE_KEY: 'SECRET-KEY', NEXT_PUBLIC_SITE_URL: 'https://example.test/' };

test('id를 모으면 중복은 합쳐지고, 빈 목록은 파일을 만들지 않음', () => {
  const f = tmp();
  assert.equal(recordChangedGames([], f), 0);
  assert.equal(fs.existsSync(f), false);
  recordChangedGames(['a', 'b'], f);
  recordChangedGames(['b', 'c'], f);
  assert.deepEqual(JSON.parse(fs.readFileSync(f, 'utf8')).sort(), ['a', 'b', 'c']);
});

test('바뀐 게 없으면 호출하지 않음', async () => {
  let called = 0;
  const r = await flushChangedGames({ file: tmp(), env, fetchImpl: async () => { called++; return { ok: true }; }, log: () => {} });
  assert.equal(called, 0);
  assert.equal(r.calls, 0);
});

test('키가 없으면 호출하지 않고 파일은 남김', async () => {
  const f = tmp();
  recordChangedGames(['a'], f);
  let called = 0;
  await flushChangedGames({ file: f, env: {}, fetchImpl: async () => { called++; return { ok: true }; }, log: () => {} });
  assert.equal(called, 0);
  assert.equal(fs.existsSync(f), true);
});

test('500개씩 나눠 한 번씩 부르고, 성공하면 파일을 지움. 로그에 키가 없음', async () => {
  const f = tmp();
  const ids = Array.from({ length: MAX_IDS_PER_CALL * 2 + 1 }, (_, i) => `id${i}`);
  recordChangedGames(ids, f);
  const bodies = [];
  const logs = [];
  const r = await flushChangedGames({
    file: f, env, log: (m) => logs.push(m),
    fetchImpl: async (url, init) => { assert.equal(url, 'https://example.test/api/admin/revalidate'); assert.equal(init.headers['x-admin-key'], 'SECRET-KEY'); bodies.push(JSON.parse(init.body).ids.length); return { ok: true }; },
  });
  assert.deepEqual(bodies, [500, 500, 1]);
  assert.equal(r.calls, 3);
  assert.equal(fs.existsSync(f), false);
  assert.ok(!logs.join('\n').includes('SECRET-KEY'));
  assert.ok(logs.join('\n').includes('1001개'));
});

test('호출이 실패하면 파일을 남겨 다시 시도할 수 있게 함', async () => {
  const f = tmp();
  recordChangedGames(['a'], f);
  const r = await flushChangedGames({ file: f, env, log: () => {}, fetchImpl: async () => ({ ok: false, status: 500 }) });
  assert.equal(r.failed, 1);
  assert.equal(fs.existsSync(f), true);
});

test('processPrices: 가격이 실제로 바뀐 게임만 onChanged로 알림', async () => {
  const mk = (id, price) => ({ id, name: id, steam_appid: id, price_history: [{ id: `h${id}`, price, discount_percent: 0, checked_at: '2026-01-01', original_price: price }] });
  const paid = [mk('1', 10000), mk('2', 20000)];
  const getBatch = async () => ({
    1: { success: true, data: { price_overview: { currency: 'KRW', final: 1000000, initial: 1000000, discount_percent: 0 } } }, // 그대로
    2: { success: true, data: { price_overview: { currency: 'KRW', final: 1500000, initial: 2000000, discount_percent: 25 } } }, // 할인
  });
  const db = { from: () => ({ insert: async () => ({ error: null }), update: () => ({ eq: () => ({ is: () => ({ select: async () => ({ data: [], error: null }) }) }) }) }) };
  const changed = [];
  await processPrices({ supabase: db, paid, getBatch, log: () => {}, onChanged: (id) => changed.push(id) });
  assert.deepEqual(changed, ['2']);
});
