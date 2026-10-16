// 실행: npm test — 1,000행 경계·서버 상한이 달라도 끝까지 읽는지
import test from 'node:test';
import assert from 'node:assert/strict';
import { readAllPages } from './paged.ts';

// 가짜 표: n행, 서버 상한 cap(요청보다 적게 줄 수 있음). 요청 기록을 남긴다
const fake = (n, cap = 1000) => {
  const calls = [];
  const page = async (from, to) => {
    calls.push([from, to]);
    const end = Math.min(to, from + cap - 1, n - 1);
    return { data: from > end ? [] : Array.from({ length: end - from + 1 }, (_, i) => ({ id: from + i })), error: null };
  };
  return { page, calls };
};
const ok = (rows, n) => {
  assert.equal(rows.length, n);
  assert.equal(new Set(rows.map((r) => r.id)).size, n, '중복 없음');
  assert.deepEqual(rows.map((r) => r.id), Array.from({ length: n }, (_, i) => i), '순서 그대로');
};

test('1,000행 경계: 0·1·999·1000·1001·1060·2000·2001·2500행 모두 끝까지', async () => {
  for (const n of [0, 1, 999, 1000, 1001, 1060, 2000, 2001, 2500]) {
    const { page } = fake(n, 1000);
    const { data, error } = await readAllPages(page);
    assert.equal(error, null);
    ok(data, n);
  }
});

test('서버 상한(Max rows)이 500·1000·2000이어도 같은 결과', async () => {
  for (const cap of [500, 1000, 2000]) {
    const { page } = fake(2345, cap);
    const { data } = await readAllPages(page);
    ok(data, 2345);
  }
});

test('정확히 1,000행이어도 다음 페이지를 한 번 더 확인한다 (1,000에서 멈추지 않음)', async () => {
  const { page, calls } = fake(1000);
  await readAllPages(page);
  assert.deepEqual(calls, [[0, 999], [1000, 1999]]);
});

test('오류가 나면 일부만 돌려주지 않고 오류를 돌려준다', async () => {
  let n = 0;
  const page = async (from) => (++n === 2 ? { data: null, error: { message: '끊김' } } : { data: Array.from({ length: 1000 }, (_, i) => ({ id: from + i })), error: null });
  const r = await readAllPages(page);
  assert.equal(r.data, null);
  assert.equal(r.error.message, '끊김');
});

test('size를 바꾸면 그 크기로 요청한다', async () => {
  const { page, calls } = fake(25, 1000);
  const { data } = await readAllPages(page, 10);
  ok(data, 25);
  assert.deepEqual(calls.map((c) => c[0]), [0, 10, 20, 25]);
});
