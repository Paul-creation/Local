// 실행: npm test — /api/admin/revalidate 본문 검사·경로 계산, 큐레이터 갱신 호출
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRevalidateBody, pathsToRevalidate } from './revalidateBody.ts';
import { revalidateCurators } from '../../scripts/lib/revalidateGames.mjs';

const U = '123e4567-e89b-12d3-a456-426614174000';

test('ids만 · curators만 · 둘 다 허용, 빈 객체·잘못된 값은 거절', () => {
  assert.deepEqual(parseRevalidateBody({ ids: [U, U] }), { ok: true, value: { ids: [U], curators: [] } });
  assert.deepEqual(parseRevalidateBody({ curators: ['gamelog.archive'] }), { ok: true, value: { ids: [], curators: ['gamelog.archive'] } });
  assert.equal(parseRevalidateBody({ ids: [U], curators: ['a'] }).ok, true);
  for (const bad of [{}, null, [], { ids: [] }, { ids: ['x'] }, { curators: [] }, { curators: ['../x'] }, { curators: ['a/b'] }, { curators: [1] }, { curators: Array(21).fill('a') }]) {
    assert.equal(parseRevalidateBody(bad).ok, false, JSON.stringify(bad));
  }
});

test('경로: 큐레이터가 있으면 /c/handle과 메인, ids만이면 게임 상세만', () => {
  assert.deepEqual(pathsToRevalidate({ ids: [U], curators: [] }), [`/games/${U}`]);
  assert.deepEqual(pathsToRevalidate({ ids: [U], curators: ['gamelog.archive'] }), [`/games/${U}`, '/c/gamelog.archive', '/']);
});

test('revalidateCurators: 핸들 없으면 호출 안 함, 키 없으면 생략, 있으면 본문에 curators·ids, 로그에 키 없음', async () => {
  const logs = [];
  const log = (m) => logs.push(m);
  let calls = [];
  const fetchImpl = async (url, init) => { calls.push({ url, init }); return { ok: true }; };
  const env = { ADMIN_REVALIDATE_KEY: 'SECRET', NEXT_PUBLIC_SITE_URL: 'https://x.test/' };
  assert.equal((await revalidateCurators({ handles: [], env, fetchImpl, log })).skipped, 'none');
  assert.equal((await revalidateCurators({ handles: ['a'], env: {}, fetchImpl, log })).skipped, 'no-key');
  assert.equal(calls.length, 0);
  const r = await revalidateCurators({ handles: ['a', 'a'], gameIds: ['g1', 'g1'], env, fetchImpl, log });
  assert.equal(r.ok, true);
  assert.equal(calls[0].url, 'https://x.test/api/admin/revalidate');
  assert.deepEqual(JSON.parse(calls[0].init.body), { curators: ['a'], ids: ['g1'] });
  assert.equal(calls[0].init.headers['x-admin-key'], 'SECRET');
  assert.ok(!logs.join('\n').includes('SECRET'));
});

test('revalidateCurators: 실패·예외여도 던지지 않음', async () => {
  const env = { ADMIN_REVALIDATE_KEY: 'k' };
  assert.equal((await revalidateCurators({ handles: ['a'], env, fetchImpl: async () => ({ ok: false, status: 500 }), log: () => {} })).ok, false);
  assert.equal((await revalidateCurators({ handles: ['a'], env, fetchImpl: async () => { throw new Error('net'); }, log: () => {} })).ok, false);
});
