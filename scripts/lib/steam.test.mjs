// 실행: npm test — 스팀 요청 제한 대응 (steamGet 재시도 + 트레일러 응답 해석)
import test from 'node:test';
import assert from 'node:assert/strict';
import { steamGet, SteamLimitError } from './steam.mjs';
import { trailerFromAppdetails } from './steam-trailer.mjs';

// fetch를 응답 목록으로 바꿔치기: 'limit'=429, 'empty'=200+빈 본문, 'html'=200+JSON 아님, 객체=200+JSON
const fast = { gapMs: 0, waits: [1, 2, 4] };
function mockFetch(responses) {
  const calls = [];
  const real = globalThis.fetch;
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    const r = responses[Math.min(calls.length - 1, responses.length - 1)];
    if (r === 'limit') return new Response('Too Many Requests', { status: 429, headers: { 'retry-after': '0' } });
    if (r === 'empty') return new Response('', { status: 200 });
    if (r === 'html') return new Response('<html>busy</html>', { status: 200 });
    if (r === 'null') return new Response('null', { status: 200 });
    if (r === 'down') throw new Error('연결 실패');
    return new Response(JSON.stringify(r), { status: 200 });
  };
  return { calls, restore: () => { globalThis.fetch = real; } };
}
const quiet = (fn) => async () => { const log = console.log; console.log = () => {}; try { await fn(); } finally { console.log = log; } };

test('429가 오면 기다렸다가 다시 시도해서 성공', quiet(async () => {
  const m = mockFetch(['limit', 'limit', { ok: 1 }]);
  try { assert.deepEqual(await steamGet('https://x/a', fast), { ok: 1 }); assert.equal(m.calls.length, 3); } finally { m.restore(); }
}));

test('빈 본문·JSON 아닌 본문·null도 다시 시도', quiet(async () => {
  for (const bad of ['empty', 'html', 'null']) {
    const m = mockFetch([bad, { ok: 2 }]);
    try { assert.deepEqual(await steamGet('https://x/b', fast), { ok: 2 }); assert.equal(m.calls.length, 2, bad); } finally { m.restore(); }
  }
}));

test('retryIf가 true인 응답(앱 번호 칸 없음)도 다시 시도', quiet(async () => {
  const m = mockFetch([{}, { 1: { success: true } }]);
  try {
    const json = await steamGet('https://x/c', { ...fast, retryIf: (j) => !(1 in j) });
    assert.deepEqual(json, { 1: { success: true } });
    assert.equal(m.calls.length, 2);
  } finally { m.restore(); }
}));

test('최대 3번 재시도해도 안 되면 SteamLimitError (모두 4번 요청)', quiet(async () => {
  for (const bad of ['limit', 'empty', 'down']) {
    const m = mockFetch([bad]);
    try {
      await assert.rejects(steamGet('https://x/d', fast), SteamLimitError);
      assert.equal(m.calls.length, 4, bad);
    } finally { m.restore(); }
  }
}));

test('404처럼 다시 시도해도 소용없는 응답은 바로 오류 (SteamLimitError 아님)', quiet(async () => {
  const real = globalThis.fetch;
  let n = 0;
  globalThis.fetch = async () => { n++; return new Response('x', { status: 404 }); };
  try {
    await assert.rejects(steamGet('https://x/e', fast), (e) => !(e instanceof SteamLimitError) && /404/.test(e.message));
    assert.equal(n, 1);
  } finally { globalThis.fetch = real; }
}));

test('트레일러 해석: HLS 주소 (highlight 우선, 쿼리 제거)', () => {
  const hls = (id, q = '?t=1') => `https://video.akamai.steamstatic.com/store_trailers/${id}/hls_264_master.m3u8${q}`;
  const json = { 10: { success: true, data: { movies: [{ highlight: false, hls_h264: hls('a') }, { highlight: true, hls_h264: hls('b') }] } } };
  assert.equal(trailerFromAppdetails(json, '10'), hls('b', ''));
});

test('트레일러 해석: 영상 없음·상점 없음은 null (확실한 답)', () => {
  assert.equal(trailerFromAppdetails({ 10: { success: true, data: {} } }, '10'), null);
  assert.equal(trailerFromAppdetails({ 10: { success: true, data: { movies: [{ highlight: true }] } } }, '10'), null);
  assert.equal(trailerFromAppdetails({ 10: { success: false } }, '10'), null);
  assert.equal(trailerFromAppdetails({ 10: { success: true, data: { movies: [{ hls_h264: 'http://evil.example/x.m3u8' }] } } }, '10'), null);
});

test('트레일러 해석: 빈 응답(null·빈 객체·다른 앱 칸)은 undefined (다시 시도해야 함)', () => {
  assert.equal(trailerFromAppdetails(null, '10'), undefined);
  assert.equal(trailerFromAppdetails({}, '10'), undefined);
  assert.equal(trailerFromAppdetails({ 99: { success: true } }, '10'), undefined);
  assert.equal(trailerFromAppdetails({ 10: null }, '10'), undefined);
  assert.equal(trailerFromAppdetails([], '10'), undefined);
});
