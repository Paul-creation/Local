import test from 'node:test';
import assert from 'node:assert/strict';
import { extractRows, runWithRetry, JUDGE_TOOL } from './judge-batches.mjs';

const tool = (games) => ({ content: [{ type: 'tool_use', name: JUDGE_TOOL.name, input: { games } }] });

test('extractRows: 도구 응답에서 games를 꺼냄', () => {
  assert.deepEqual(extractRows(tool([{ index: 1, barrier: '낮음' }])), [{ index: 1, barrier: '낮음' }]);
});

test('extractRows: 도구 호출이 없으면 원문 앞부분이 붙은 오류', () => {
  const big = 'x'.repeat(5000);
  assert.throws(() => extractRows({ content: [{ type: 'text', text: big }] }), (e) => e.raw.length === 2000);
});

test('runWithRetry: 첫 시도 성공이면 한 번만 부름', async () => {
  let calls = 0;
  const r = await runWithRetry([1, 2, 3], async () => { calls++; return { rows: [], cost: 0 }; });
  assert.equal(calls, 1);
  assert.equal(r.ok, true);
});

test('runWithRetry: 한 번 실패해도 같은 묶음 재시도로 성공', async () => {
  let calls = 0;
  const r = await runWithRetry([1, 2, 3], async () => { if (++calls === 1) throw new Error('깨짐'); return { rows: [], cost: 0 }; });
  assert.equal(calls, 2);
  assert.equal(r.ok, true);
  assert.equal(r.parts.length, 1);
});

test('runWithRetry: 통째로 두 번 실패하면 반으로 나눠 각각 처리', async () => {
  const sizes = [];
  const r = await runWithRetry([1, 2, 3, 4, 5], async (b) => { sizes.push(b.length); if (b.length > 3) throw new Error('깨짐'); return { rows: [], cost: 0 }; });
  assert.deepEqual(sizes, [5, 5, 3, 2]);
  assert.equal(r.ok, true);
  assert.deepEqual(r.parts.map((p) => p.batch), [[1, 2, 3], [4, 5]]);
});

test('runWithRetry: 한쪽 절반만 끝까지 실패하면 그 게임들만 lost', async () => {
  const r = await runWithRetry([1, 2, 3, 4], async (b) => { if (b.length > 2 || b.includes(4)) throw Object.assign(new Error('깨짐'), { raw: 'abc' }); return { rows: [], cost: 0 }; });
  assert.equal(r.ok, false);
  assert.deepEqual(r.lost, [3, 4]);
  assert.deepEqual(r.parts.map((p) => p.batch), [[1, 2]]);
  assert.equal(r.errors.at(-1).raw, 'abc');
});

test('runWithRetry: 1개짜리 묶음은 2번 시도 뒤 쪼개지 않고 실패', async () => {
  let calls = 0;
  const r = await runWithRetry([1], async () => { calls++; throw new Error('깨짐'); });
  assert.equal(calls, 2);
  assert.equal(r.ok, false);
});
