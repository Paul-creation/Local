// 실행: npm test — 제조사 일치 비교 판정
import test from 'node:test';
import assert from 'node:assert/strict';
import { requiredTier, partMeets, judgeLevel, judgeGame } from './specJudge.ts';

const pc = (gpuVendor, gpuTier, cpuVendor = 'intel', cpuTier = 6, ram = 16) => ({ cpu: { vendor: cpuVendor, tier: cpuTier }, gpu: { vendor: gpuVendor, tier: gpuTier }, ram_gb: ram });

test('요구 등급: 같은 제조사가 있으면 그것, 없으면 적힌 것 중 가장 높은 것', () => {
  const req = { nvidia: 9, amd: 11, intel: 6 };
  assert.equal(requiredTier(req, 'nvidia'), 9);
  assert.equal(requiredTier(req, 'amd'), 11);
  assert.equal(requiredTier(req, 'intel'), 6);
  assert.equal(requiredTier({ nvidia: 9, amd: 11 }, 'intel'), 11); // Intel 사용자: 없으니 가장 높은 11
  assert.equal(requiredTier({ nvidia: 9 }, 'amd'), 9); // 한 제조사만 적혀 있으면 그 하나
  assert.equal(requiredTier({ intel: 4, amd: 6 }, 'intel'), 4);
  assert.equal(requiredTier(null, 'amd'), null);
  assert.equal(requiredTier({}, 'amd'), null);
});

test('Intel 내장·Arc도 같은 규칙: 요구에 Intel 항목이 없으면 가장 높은 등급과 비교', () => {
  assert.equal(partMeets({ vendor: 'intel', tier: 6 }, { nvidia: 9, amd: 8 }), false); // Arc A380(6) < 9
  assert.equal(partMeets({ vendor: 'intel', tier: 10 }, { nvidia: 9, amd: 8 }), true); // Arc A580(10) ≥ 9
  assert.equal(partMeets({ vendor: 'intel', tier: 6 }, { nvidia: 9, intel: 6 }), true); // Intel 항목이 있으면 그것과
  assert.equal(partMeets({ vendor: 'nvidia', tier: 9 }, { nvidia: 9, amd: 11, intel: 6 }), true); // NVIDIA 사용자는 AMD 11을 안 봄
  assert.equal(partMeets({ vendor: 'amd', tier: 9 }, { nvidia: 9, amd: 11 }), false);
});

test('low_spec({ any: 1 })은 어떤 PC든 충족', () => {
  assert.equal(partMeets({ vendor: 'amd', tier: 1 }, { any: 1 }), true);
  assert.equal(partMeets({ vendor: 'intel', tier: 1 }, { any: 1 }), true);
});

test('한 단계: 부족이 판정 불가보다 먼저, 읽지 못한 칸은 판정 불가', () => {
  const ok = { cpu: { intel: 5 }, gpu: { nvidia: 9 }, ram_gb: 8 };
  assert.equal(judgeLevel(pc('nvidia', 9), ok).result, 'pass');
  assert.equal(judgeLevel(pc('nvidia', 8), ok).result, 'fail');
  assert.equal(judgeLevel(pc('nvidia', 9, 'intel', 6, 4), ok).result, 'fail'); // RAM 4 < 8
  assert.equal(judgeLevel(pc('nvidia', 9), { ...ok, gpu: null }).result, 'unknown');
  assert.equal(judgeLevel(pc('nvidia', 5), { ...ok, gpu: null }).result, 'unknown'); // 그래픽을 못 읽었고 나머지는 충족
  assert.equal(judgeLevel(pc('nvidia', 9, 'intel', 3), { ...ok, gpu: null }).result, 'fail'); // 읽은 CPU가 모자라면 부족이 먼저
  assert.equal(judgeLevel(pc('nvidia', 9), { ...ok, ram_gb: null }).result, 'pass'); // 요구 RAM을 못 읽어도 막지 않음
});

test('게임: 권장 충족 > 최소 충족 > 부족 > 판정 불가', () => {
  const min = { cpu: { intel: 4, amd: 5 }, gpu: { nvidia: 6, amd: 8 }, ram_gb: 8 };
  const rec = { cpu: { intel: 6, amd: 7 }, gpu: { nvidia: 9, amd: 11 }, ram_gb: 16 };
  assert.equal(judgeGame(pc('nvidia', 9, 'intel', 6, 16), { min, rec }).verdict, 'rec');
  assert.equal(judgeGame(pc('nvidia', 7, 'intel', 6, 16), { min, rec }).verdict, 'min');
  assert.equal(judgeGame(pc('amd', 9, 'intel', 6, 16), { min, rec }).verdict, 'min'); // AMD는 권장 11이 필요
  const bad = judgeGame(pc('nvidia', 3, 'intel', 3, 4), { min, rec });
  assert.equal(bad.verdict, 'insufficient');
  assert.deepEqual(bad.failed, ['cpu', 'gpu', 'ram']);
  assert.equal(judgeGame(pc('nvidia', 9), { min, rec: null }).verdict, 'min'); // 권장 없음
  assert.equal(judgeGame(pc('nvidia', 9), { min: null, rec }).verdict, 'unknown');
  assert.equal(judgeGame(pc('nvidia', 9), null).verdict, 'unknown');
  assert.equal(judgeGame(pc('nvidia', 9), { min: { ...min, gpu: null }, rec }).verdict, 'unknown');
});

test('권장을 읽지 못해도(권장 판정 불가) 최소는 충족으로 보여준다', () => {
  const min = { cpu: { intel: 4 }, gpu: { nvidia: 6 }, ram_gb: 8 };
  const rec = { cpu: null, gpu: { nvidia: 9 }, ram_gb: 16 };
  const r = judgeGame(pc('nvidia', 10), { min, rec });
  assert.equal(r.verdict, 'min'); assert.equal(r.rec.result, 'unknown');
});

// ── 3단계: 상세 페이지 판정 (judgePc) ──
import { judgePc, hasJudgeableSpec, verdictText, equalizePair } from './specJudge.ts';

const full = (cpu, gpu, ram) => ({ cpu: { intel: cpu }, gpu: { nvidia: gpu }, ram_gb: ram });

test('judgePc: 권장 충족 / 최소 충족 / 최소 미달(항목 이름 포함)', () => {
  const parsed = { min: full(4, 6, 8), rec: full(6, 9, 16) };
  assert.deepEqual(judgePc(pc('nvidia', 9, 'intel', 6, 16), parsed), { level: 'rec', failed: [], recMissing: false, partial: false });
  assert.deepEqual(judgePc(pc('nvidia', 7, 'intel', 6, 16), parsed), { level: 'min', failed: [], recMissing: false, partial: false });
  assert.deepEqual(judgePc(pc('nvidia', 3, 'intel', 3, 4), parsed), { level: 'fail', failed: ['cpu', 'gpu', 'ram'], recMissing: false, partial: false });
  assert.deepEqual(judgePc(pc('nvidia', 3, 'intel', 6, 16), parsed).failed, ['gpu']);
});

test('judgePc: 제조사 일치 비교와 {any:1}·low_spec 충족', () => {
  const parsed = { min: { cpu: { any: 1 }, gpu: { nvidia: 6, amd: 8 }, ram_gb: 4 }, rec: null };
  assert.equal(judgePc(pc('amd', 7, 'amd', 1, 8), parsed).level, 'fail'); // AMD는 8 필요
  assert.equal(judgePc(pc('amd', 8, 'amd', 1, 8), parsed).level, 'min'); // CPU {any:1}은 충족
  assert.equal(judgePc(pc('nvidia', 6, 'amd', 1, 8), parsed).level, 'min');
  assert.equal(judgePc(pc('intel', 7, 'intel', 1, 8), parsed).level, 'fail'); // Intel 항목 없음 → 가장 높은 8과 비교
});

test('judgePc: rec가 null이거나 rec의 한 항목이라도 못 읽으면 최소 기준 + "권장 사양 정보 부족"', () => {
  const min = full(4, 6, 8);
  const strong = pc('nvidia', 15, 'intel', 8, 64);
  assert.deepEqual(judgePc(strong, { min, rec: null }), { level: 'min', failed: [], recMissing: true, partial: false });
  assert.deepEqual(judgePc(strong, { min }), { level: 'min', failed: [], recMissing: true, partial: false });
  for (const rec of [{ ...full(6, 9, 16), cpu: null }, { ...full(6, 9, 16), gpu: null }, { ...full(6, 9, 16), ram_gb: null }]) {
    const v = judgePc(strong, { min, rec });
    assert.equal(v.level, 'min'); // 읽힌 권장 항목을 다 충족해도 권장 충족은 나오지 않음
    assert.equal(v.recMissing, true);
  }
});

test('judgePc: 최소는 읽힌 항목만으로 판정하고 일부만 읽혔으면 "일부 사양만 확인됨"', () => {
  const rec = full(6, 9, 16);
  const v = judgePc(pc('nvidia', 9, 'intel', 6, 16), { min: { cpu: null, gpu: { nvidia: 6 }, ram_gb: 8 }, rec });
  assert.deepEqual(v, { level: 'rec', failed: [], recMissing: false, partial: true });
  assert.equal(judgePc(pc('nvidia', 9, 'intel', 6, 16), { min: { cpu: null, gpu: { nvidia: 6 }, ram_gb: 8 }, rec: null }).level, 'min');
  const fail = judgePc(pc('nvidia', 3, 'intel', 6, 16), { min: { cpu: null, gpu: { nvidia: 6 }, ram_gb: null }, rec: null });
  assert.deepEqual(fail, { level: 'fail', failed: ['gpu'], recMissing: true, partial: true });
});

test('judgePc: 최소 세 항목이 전부 안 읽히거나 min이 없으면 null', () => {
  const user = pc('nvidia', 9);
  assert.equal(judgePc(user, { min: { cpu: null, gpu: null, ram_gb: null }, rec: full(6, 9, 16) }), null);
  assert.equal(judgePc(user, { min: null, rec: full(6, 9, 16) }), null);
  assert.equal(judgePc(user, null), null);
  assert.equal(judgePc(user, undefined), null);
  assert.equal(hasJudgeableSpec({ min: { cpu: null, gpu: null, ram_gb: null } }), false);
  assert.equal(hasJudgeableSpec({ min: { cpu: null, gpu: null, ram_gb: 8 } }), true);
  assert.equal(hasJudgeableSpec(null), false);
});

test('verdictText: 문구와 플래그', () => {
  assert.deepEqual(verdictText({ level: 'rec', failed: [], recMissing: false, partial: false }), { main: '권장 사양 충족', flags: [] });
  assert.deepEqual(verdictText({ level: 'min', failed: [], recMissing: true, partial: false }), { main: '최소 사양 충족', flags: ['권장 사양 정보 부족'] });
  assert.deepEqual(verdictText({ level: 'min', failed: [], recMissing: true, partial: true }).flags, ['권장 사양 정보 부족', '일부 사양만 확인됨']);
  assert.equal(verdictText({ level: 'fail', failed: ['gpu', 'ram'], recMissing: false, partial: false }).main, '최소 사양 미달 (그래픽카드·메모리)');
});

test('P3: 한 줄에 AMD·Intel 짝이 1단계 차이면 낮은 쪽으로 (CPU만)', () => {
  const user = (cpuVendor, cpuTier) => ({ cpu: { vendor: cpuVendor, tier: cpuTier }, gpu: { vendor: 'nvidia', tier: 11 }, ram_gb: 16 });
  const spec = (cpu, gpu = { nvidia: 9 }) => ({ min: { cpu, gpu, ram_gb: 8 }, rec: null });
  assert.deepEqual(equalizePair({ amd: 7, intel: 6 }), { amd: 6, intel: 6 });
  assert.deepEqual(equalizePair({ amd: 6, intel: 7 }), { amd: 6, intel: 6 });
  assert.deepEqual(equalizePair({ amd: 8, intel: 6 }), { amd: 8, intel: 6 }); // 2단계 차이는 그대로
  assert.deepEqual(equalizePair({ amd: 7, intel: 7 }), { amd: 7, intel: 7 });
  assert.deepEqual(equalizePair({ intel: 7 }), { intel: 7 }); // 한쪽만 적힌 요구는 그대로
  assert.equal(equalizePair(null), null);
  // Ryzen 5 3600(6) vs "i5-10400(6) / Ryzen 5 5600(7)" → 충족
  assert.equal(judgePc(user('amd', 6), spec({ amd: 7, intel: 6 })).level, 'min');
  assert.equal(judgePc(user('amd', 5), spec({ amd: 7, intel: 6 })).level, 'fail'); // 5는 낮은 쪽(6)에도 모자람
  assert.equal(judgePc(user('amd', 6), spec({ amd: 8, intel: 6 })).level, 'fail'); // 2단계 차이는 AMD 8 그대로
  assert.equal(judgePc(user('amd', 6), spec({ intel: 7 })).level, 'fail'); // Intel만 적힌 요구는 그대로 비교
  // GPU에는 적용하지 않음: RTX 3060(11) vs "GTX 1080 Ti(12) / RX 6800(14)"는 그대로 미달
  assert.equal(judgePc(user('amd', 8), spec({ intel: 5 }, { nvidia: 12, amd: 13 })).level, 'fail');
  assert.deepEqual(judgeLevel(user('amd', 6), { cpu: { amd: 7, intel: 6 }, gpu: { nvidia: 9 }, ram_gb: 8 }), { cpu: true, gpu: true, ram: true, result: 'pass' });
});
