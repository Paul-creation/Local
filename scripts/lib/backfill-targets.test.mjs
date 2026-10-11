// 실행: npm test — backfill-price-history 증분 대상 고르기
const { default: test } = await import('node:test');
const { default: assert } = await import('node:assert/strict');
const { isBackfillTarget, dayHash, kstWeekday, MIN_RECORDS } = await import('./backfill-targets.mjs');

const hist = (n) => Array.from({ length: n }, (_, i) => ({ price: 1000 + i, checked_at: `2026-01-0${i + 1}T00:00:00Z` }));
const game = (id, over = {}) => ({ id, itad_id: 'x', price_history: hist(MIN_RECORDS), ...over });

test('ITAD ID가 없거나 기록이 5건 미만이면 요일과 상관없이 매일 대상', () => {
  for (let day = 0; day < 7; day++) {
    assert.equal(isBackfillTarget(game('a', { itad_id: null }), day), true);
    assert.equal(isBackfillTarget(game('a', { price_history: hist(MIN_RECORDS - 1) }), day), true);
    assert.equal(isBackfillTarget(game('a', { price_history: null }), day), true);
  }
});

test('나머지 게임은 7일 중 정확히 하루만 대상', () => {
  const ids = Array.from({ length: 300 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`);
  const perDay = Array(7).fill(0);
  for (const id of ids) {
    const days = [0, 1, 2, 3, 4, 5, 6].filter((d) => isBackfillTarget(game(id), d));
    assert.equal(days.length, 1);
    perDay[days[0]]++;
  }
  assert.ok(perDay.every((n) => n > 20), `요일별 분포 ${perDay}`); // 300/7 ≈ 43, 한쪽에 몰리지 않음
});

test('같은 id는 늘 같은 요일, --all은 전부', () => {
  assert.equal(dayHash('abc'), dayHash('abc'));
  assert.equal(isBackfillTarget(game('abc'), (dayHash('abc') + 1) % 7, true), true);
});

test('한국 시간 요일: UTC 일요일 15:00은 한국 월요일 00:00', () => {
  assert.equal(kstWeekday(Date.parse('2026-10-11T14:59:00Z')), 0); // 일요일 23:59 KST
  assert.equal(kstWeekday(Date.parse('2026-10-11T15:00:00Z')), 1); // 월요일 00:00 KST
});
