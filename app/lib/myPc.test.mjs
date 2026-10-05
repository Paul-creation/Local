// 실행: npm test — 내 PC 저장 값 검증과 WebGL 렌더러 이름 정리·등급표 매칭
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseMyPc, serializeMyPc, toUserPc, rendererToText, RAM_CHOICES } from './myPc.ts';
import { alternativesOf } from './specParse.ts';

const part = (key, vendor, tier) => ({ key, name: key, vendor, tier });
const pc = { v: 1, gpu: part('rtx 3060', 'nvidia', 12), cpu: part('ryzen 5 3600', 'amd', 6), ram: 16 };

test('저장 값: 저장했다 읽으면 그대로, 값이 없거나 깨졌으면 null(미입력)', () => {
  assert.deepEqual(parseMyPc(serializeMyPc(pc)), pc);
  assert.deepEqual(toUserPc(pc), { cpu: { vendor: 'amd', tier: 6 }, gpu: { vendor: 'nvidia', tier: 12 }, ram_gb: 16 });
  for (const bad of [null, undefined, '', 'not json', '{', '[]', 'null', '123', '{}']) assert.equal(parseMyPc(bad), null, String(bad));
  const j = (o) => JSON.stringify(o);
  assert.equal(parseMyPc(j({ ...pc, v: 2 })), null);
  assert.equal(parseMyPc(j({ ...pc, ram: 12 })), null); // 선택지에 없는 RAM
  assert.equal(parseMyPc(j({ ...pc, ram: '16' })), null);
  assert.equal(parseMyPc(j({ ...pc, gpu: undefined })), null);
  assert.equal(parseMyPc(j({ ...pc, gpu: part('x', 'matrox', 3) })), null); // 모르는 제조사
  assert.equal(parseMyPc(j({ ...pc, cpu: part('x', 'intel', 0) })), null);
  assert.equal(parseMyPc(j({ ...pc, cpu: part('x', 'intel', 2.5) })), null);
  assert.equal(parseMyPc(j({ ...pc, cpu: { key: 'x', name: '', vendor: 'intel', tier: 3 } })), null);
  assert.ok(RAM_CHOICES.includes(4) && RAM_CHOICES.includes(64));
});

test('WebGL 렌더러 이름 정리', () => {
  assert.equal(rendererToText('ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)'), 'NVIDIA GeForce RTX 3060');
  assert.equal(rendererToText('ANGLE (AMD, AMD Radeon RX 6700 XT (0x000073DF) Direct3D11 vs_5_0 ps_5_0, D3D11)'), 'AMD Radeon RX 6700 XT');
  assert.equal(rendererToText('ANGLE (Intel, Intel(R) UHD Graphics 630 Direct3D11 vs_5_0 ps_5_0, D3D11)'), 'Intel(R) UHD Graphics 630');
  assert.equal(rendererToText('NVIDIA GeForce GTX 1050/PCIe/SSE2'), 'NVIDIA GeForce GTX 1050');
  assert.equal(rendererToText('ANGLE (Apple, ANGLE Metal Renderer: Apple M2, Unspecified Version)'), null);
  for (const soft of ['ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader driver)', 'llvmpipe (LLVM 15.0.7, 256 bits)', 'Apple GPU', 'Microsoft Basic Render Driver', null, undefined, '']) assert.equal(rendererToText(soft), null, String(soft));
});

test('렌더러 이름 → 등급표 매칭 (실제 등급표) / 못 찾으면 빈 결과', () => {
  const read = (f) => JSON.parse(readFileSync(new URL(`../../data/pc-spec/${f}`, import.meta.url), 'utf8'));
  const tables = { gpu: read('gpu-tiers.json'), cpu: read('cpu-tiers.json') };
  const hit = (r) => alternativesOf('gpu', rendererToText(r), tables)[0];
  assert.equal(hit('ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)').key, 'rtx 3060');
  assert.equal(hit('ANGLE (AMD, AMD Radeon RX 6700 XT (0x000073DF) Direct3D11 vs_5_0 ps_5_0, D3D11)').vendor, 'amd');
  assert.equal(hit('NVIDIA GeForce GTX 1050/PCIe/SSE2').key, 'gtx 1050');
  assert.equal(hit('ANGLE (Intel, Intel(R) UHD Graphics 630 Direct3D11 vs_5_0 ps_5_0, D3D11)').vendor, 'intel');
  assert.equal(hit('Mesa Something Unknown 9000'), undefined);
});
