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
