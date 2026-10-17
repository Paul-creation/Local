// 실행: npm test — enrich-itad-heat 요일 커서·ITAD 미등록 게임 건너뛰기 (ITAD 호출 없음)
const { default: test } = await import('node:test');
const { default: assert } = await import('node:assert/strict');
const fs = await import('node:fs');
const os = await import('node:os');
const path = await import('node:path');
const { hotIds, HOT_TOP_N, isHeatTarget, isKnownMissing, loadMissing, saveMissing, MISSING_TTL_DAYS } = await import('./heat-targets.mjs');
const { processHeatBatches } = await import('./itad-heat-batch.mjs');

const NOW = Date.parse('2026-10-17T00:00:00Z');
const ids = Array.from({ length: 700 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`);
const game = (id, over = {}) => ({ id, steam_appid: 1000, itad_id: 'x', ...over });

test('ITAD ID가 있는 게임은 (상위권이 아니면) 7일 중 정확히 하루만 대상', () => {
  const perDay = Array(7).fill(0);
  for (const id of ids) {
    const days = [0, 1, 2, 3, 4, 5, 6].filter((d) => isHeatTarget(game(id), d));
    assert.equal(days.length, 1);
    perDay[days[0]]++;
  }
  assert.ok(perDay.every((n) => n > 60), `요일별 분포 ${perDay}`); // 700/7 = 100, 한쪽에 몰리지 않음
});

test('ITAD ID가 없는 새 게임은 요일과 상관없이 매일 대상', () => {
  for (let d = 0; d < 7; d++) assert.equal(isHeatTarget(game('a', { itad_id: null }), d, { now: NOW }), true);
});

test('ITAD에 없다고 확인된 게임은 TTL 안에서 건너뛰고, 지나면 다시 찾아봄', () => {
  const day = 86400 * 1000;
  const missing = { 1000: new Date(NOW - (MISSING_TTL_DAYS - 1) * day).toISOString() };
  assert.equal(isHeatTarget(game('a', { itad_id: null }), 0, { missing, now: NOW }), false);
  assert.equal(isHeatTarget(game('a', { itad_id: null, steam_appid: 2000 }), 0, { missing, now: NOW }), true);
  const old = { 1000: new Date(NOW - (MISSING_TTL_DAYS + 1) * day).toISOString() };
  assert.equal(isHeatTarget(game('a', { itad_id: null }), 0, { missing: old, now: NOW }), true);
  assert.equal(isKnownMissing({ 1000: 'not a date' }, 1000, NOW), false);
});

test('--all은 전부 대상, 없음 캐시도 무시', () => {
  const missing = { 1000: new Date(NOW).toISOString() };
  assert.equal(isHeatTarget(game('abc', { itad_id: null }), 0, { all: true, missing, now: NOW }), true);
  assert.equal(isHeatTarget(game('abc'), 99, { all: true }), true);
});

test('없음 캐시 파일: 저장·불러오기, 없거나 깨진 파일은 빈 값', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'heat-missing-'));
  const file = path.join(dir, 'sub', 'm.json');
  assert.deepEqual(loadMissing(file), {});
  saveMissing({ 5: '2026-10-17T00:00:00.000Z' }, file);
  assert.deepEqual(loadMissing(file), { 5: '2026-10-17T00:00:00.000Z' });
  fs.writeFileSync(file, '{깨짐');
  assert.deepEqual(loadMissing(file), {});
});

// 하루치 모의 실행: 가짜 ITAD 호출 수를 센다
async function simulate(games, weekday, missing) {
  const calls = { lookup: 0, info: 0, lowBatches: 0 };
  const targets = games.filter((g) => isHeatTarget(g, weekday, { missing, now: NOW }));
  await processHeatBatches({
    games: targets,
    batchSize: 100,
    collect: async (g) => {
      if (!g.itad_id) {
        calls.lookup++;
        if (g.steam_appid >= 9000) { missing[g.steam_appid] = new Date(NOW).toISOString(); return null; }
      }
      calls.info++;
      return { update: { heat_rank: 1 }, itadId: g.itad_id ?? 'new' };
    },
    getLows: async () => { calls.lowBatches++; return new Map(); },
    save: async () => true,
    isLimitError: () => false,
    log: () => {},
  });
  return { ...calls, targets: targets.length };
}

test('모의 하루: 첫날 미등록 게임을 한 번 찾고 다음 날부터는 lookup 0건, 요일 몫만 조회', async () => {
  const games = ids.map((id, i) => game(id, { steam_appid: i }));
  const free = [0, 1, 2].map((i) => game(`free-${i}`, { itad_id: null, steam_appid: 9000 + i }));
  const all = [...games, ...free];
  const missing = {};
  const day1 = await simulate(all, 3, missing);
  assert.equal(day1.lookup, 3);
  const day2 = await simulate(all, 4, missing);
  assert.equal(day2.lookup, 0);
  assert.ok(day2.info > 60 && day2.info < 140, `하루 info 조회 ${day2.info}건`); // 700/7 ≈ 100
  assert.ok(day2.info < games.length / 5);
});

test('heat_rank 상위 N개는 요일과 상관없이 매일 대상 (순위 값이 아니라 목록 안 순서 기준)', () => {
  const games = ids.map((id, i) => game(id, { heat_rank: i === 5 ? null : (i + 1) * 3 })); // 순위 값에 빈 곳, 순위 없는 게임 1개
  const hot = hotIds(games);
  assert.equal(hot.size, HOT_TOP_N);
  assert.equal(hot.has(ids[0]), true);
  assert.equal(hot.has(ids[5]), false);
  assert.equal(hot.has(ids[HOT_TOP_N + 1]), false);
  for (let d = 0; d < 7; d++) assert.equal(isHeatTarget(game(ids[0]), d, { hot }), true);
  const sum = Array(7).fill(0);
  for (let d = 0; d < 7; d++) sum[d] = games.filter((g) => isHeatTarget(g, d, { hot })).length;
  assert.ok(sum.every((n) => n >= HOT_TOP_N), `요일별 대상 ${sum}`);
});
