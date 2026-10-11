// 실행: npm test — ITAD 속도 제한기: 창 안 최대 건수, 429 차단 시간, 단계(프로세스) 사이 파일 공유
const { default: test } = await import('node:test');
const { default: assert } = await import('node:assert/strict');
const fs = await import('node:fs');
const os = await import('node:os');
const path = await import('node:path');
const { createLimiter } = await import('./itad-limiter.mjs');

// 가짜 시계: sleep하면 시계만 앞으로 감
const clock = (start = 1_000_000) => {
  const c = { t: start, slept: [] };
  c.now = () => c.t;
  c.sleep = async (ms) => { c.slept.push(ms); c.t += ms; };
  return c;
};
const quiet = () => {};

test('창 안에 max건까지는 바로, 그 다음은 가장 오래된 요청이 창 밖으로 나갈 때까지 기다림', async () => {
  const c = clock();
  const lim = createLimiter({ file: null, windowMs: 300000, max: 3, now: c.now, sleep: c.sleep, log: quiet });
  const start = c.t;
  for (let i = 0; i < 3; i++) { await lim.acquire(); c.t += 1000; } // 3건, 3초 사용
  assert.deepEqual(c.slept, []);
  await lim.acquire(); // 4번째는 첫 요청 + 300초까지 기다림
  assert.ok(c.t - start >= 300000, `기다린 시간 ${c.t - start}`);
  assert.ok(c.t - start < 301000);
});

test('어떤 5분 구간에서도 max건을 넘지 않음', async () => {
  const c = clock();
  const lim = createLimiter({ file: null, windowMs: 300000, max: 5, now: c.now, sleep: c.sleep, log: quiet });
  const times = [];
  for (let i = 0; i < 40; i++) { await lim.acquire(); times.push(c.t); c.t += 1500; }
  for (let i = 0; i + 5 < times.length; i++) assert.ok(times[i + 5] - times[i] >= 300000, `${i}번째부터 6건이 ${times[i + 5] - times[i]}ms 안에 나감`);
});

test('block: 429 대기 시각까지 모든 요청을 막음', async () => {
  const c = clock();
  const lim = createLimiter({ file: null, windowMs: 300000, max: 80, now: c.now, sleep: c.sleep, log: quiet });
  const start = c.t;
  lim.block(c.t + 90000);
  await lim.acquire();
  assert.ok(c.t - start >= 90000 && c.t - start < 91000);
});

test('파일로 공유: 다른 제한기(다른 단계)가 쓴 요청도 같이 셈, 대기 로그를 남김', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'itad-limiter-'));
  const file = path.join(dir, 'w.json');
  const c = clock();
  const logs = [];
  const a = createLimiter({ file, windowMs: 300000, max: 2, now: c.now, sleep: c.sleep, log: quiet });
  const b = createLimiter({ file, windowMs: 300000, max: 2, now: c.now, sleep: c.sleep, log: (m) => logs.push(m) });
  await a.acquire(); c.t += 1000;
  await a.acquire(); c.t += 1000;
  const start = c.t;
  await b.acquire(); // 새 프로세스처럼 b는 a의 2건을 파일에서 읽어 기다림
  assert.ok(c.t - start >= 298000);
  assert.equal(logs.length, 1);
  assert.match(logs[0], /^ITAD 속도 제한기: \d+초 대기 \(최근 300초 2\/2건\)$/);
  fs.rmSync(dir, { recursive: true });
});

test('상태 파일이 깨져 있어도 막히지 않음', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'itad-limiter-'));
  const file = path.join(dir, 'w.json');
  fs.writeFileSync(file, '{깨짐');
  const c = clock();
  const lim = createLimiter({ file, windowMs: 300000, max: 2, now: c.now, sleep: c.sleep, log: quiet });
  await lim.acquire();
  assert.deepEqual(c.slept, []);
  fs.rmSync(dir, { recursive: true });
});
