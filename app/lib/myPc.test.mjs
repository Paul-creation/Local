// 실행: npm test — 내 PC 저장 값 검증과 WebGL 렌더러 이름 정리·등급표 매칭
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseMyPc, serializeMyPc, toUserPc, rendererToText, refreshMyPc, RAM_CHOICES } from './myPc.ts';
import { alternativesOf } from './specParse.ts';

const part = (key, vendor, tier) => ({ key, name: key, vendor, tier });
const pc = { v: 2, tv: 2, gpu: part('rtx 3060', 'nvidia', 12), cpu: part('ryzen 5 3600', 'amd', 6), ram: 16 };

test('저장 값: 저장했다 읽으면 그대로, 값이 없거나 깨졌으면 null(미입력)', () => {
  assert.deepEqual(parseMyPc(serializeMyPc(pc)), pc);
  assert.deepEqual(toUserPc(pc), { cpu: { vendor: 'amd', tier: 6 }, gpu: { vendor: 'nvidia', tier: 12 }, ram_gb: 16 });
  for (const bad of [null, undefined, '', 'not json', '{', '[]', 'null', '123', '{}']) assert.equal(parseMyPc(bad), null, String(bad));
  const j = (o) => JSON.stringify(o);
  assert.equal(parseMyPc(j({ ...pc, v: 3 })), null);
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

test('등급표 버전: 예전 모양(v1)은 tv 0, 깨진 tv도 0으로 읽는다', () => {
  const { v, tv, ...rest } = pc;
  assert.equal(parseMyPc(JSON.stringify({ v: 1, ...rest })).tv, 0);
  assert.equal(parseMyPc(JSON.stringify({ ...pc, tv: 'x' })).tv, 0);
  assert.equal(parseMyPc(JSON.stringify({ ...pc, tv: -1 })).tv, 0);
  assert.equal(parseMyPc(JSON.stringify(pc)).tv, 2);
});

test('refreshMyPc: 저장된 부품 key로 등급을 다시 계산, 사라진 key는 미입력(null)', () => {
  const tables = {
    gpu: [{ key: 'rtx 3060', name: 'GeForce RTX 3060', vendor: 'nvidia', tier: 11 }, { key: 'gtx 1050 ti', name: 'GeForce GTX 1050 Ti', vendor: 'nvidia', tier: 6 }],
    cpu: [{ key: 'ryzen 5 3600', name: 'AMD Ryzen 5 3600', vendor: 'amd', tier: 6 }],
  };
  const old = { v: 2, tv: 1, gpu: { key: 'rtx 3060', name: '옛 이름', vendor: 'nvidia', tier: 9 }, cpu: { key: 'ryzen 5 3600', name: 'x', vendor: 'amd', tier: 7 }, ram: 16 };
  assert.deepEqual(refreshMyPc(old, tables, 5), { v: 2, tv: 5, gpu: tables.gpu[0], cpu: tables.cpu[0], ram: 16 }); // 이름·제조사·등급을 표 값으로, tv는 새 버전
  assert.equal(refreshMyPc({ ...old, gpu: { ...old.gpu, key: 'rtx 9999' } }, tables, 5), null); // GPU key 사라짐
  assert.equal(refreshMyPc({ ...old, cpu: { ...old.cpu, key: 'gone' } }, tables, 5), null); // CPU key 사라짐
  assert.equal(refreshMyPc(old, { gpu: [{ ...tables.gpu[0], vendor: 'matrox' }], cpu: tables.cpu }, 5), null); // 모르는 제조사
  assert.equal(refreshMyPc(old, { gpu: [], cpu: [] }, 5), null);
});

test('실제 등급표: 저장해 둔 key가 모두 등급표에 있다 (사라지면 사용자 입력이 지워지므로 key를 지우지 않는다)', () => {
  const read = (f) => JSON.parse(readFileSync(new URL(`../../data/pc-spec/${f}`, import.meta.url), 'utf8')).entries;
  const gpu = read('gpu-tiers.json'), cpu = read('cpu-tiers.json');
  const mk = (g, c) => ({ v: 2, tv: 0, gpu: { key: g.key, name: g.name, vendor: g.vendor, tier: 1 }, cpu: { key: c.key, name: c.name, vendor: c.vendor, tier: 1 }, ram: 8 });
  const r = refreshMyPc(mk(gpu.find((e) => e.key === 'rtx 3060'), cpu.find((e) => e.key === 'ryzen 5 gen3')), { gpu, cpu }, 2);
  assert.equal(r.gpu.tier, 11); assert.equal(r.cpu.tier, 6); assert.equal(r.tv, 2);
});
