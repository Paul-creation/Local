// 실행: npm test (Node 내장 테스트) — 사양 파서와 등급표
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseSpecText, lowestTier, highestTier } from './specParse.ts';

const tables = { gpu: JSON.parse(fs.readFileSync('data/pc-spec/gpu-tiers.json', 'utf8')), cpu: JSON.parse(fs.readFileSync('data/pc-spec/cpu-tiers.json', 'utf8')) };
const spec = (cpu, gpu, ram = '8 GB RAM', sto = '10 GB 사용 가능 공간') => `운영 체제: Windows 10 / 프로세서: ${cpu} / 메모리: ${ram} / 그래픽: ${gpu} / 저장 공간: ${sto}`;
const p0 = (cpu, gpu, ram, sto) => parseSpecText(spec(cpu, gpu, ram, sto), tables);
// 대안 표기는 제조사별로 보존된다. 아래 기존 단언은 "가장 낮은 등급" 기준이라 lowestTier로 읽는다
const p = (...a) => { const r = p0(...a); return r && { ...r, cpu_tier: lowestTier(r.cpu), gpu_tier: lowestTier(r.gpu) }; };

test('등급표: 키 중복 없음·등급 범위·노트북은 데스크톱보다 한 단계 낮음', () => {
  for (const [name, max] of [['gpu', 15], ['cpu', 8]]) {
    const keys = new Set();
    for (const e of tables[name].entries) {
      assert.ok(!keys.has(e.key), `중복 ${e.key}`); keys.add(e.key);
      assert.ok(e.tier >= 1 && e.tier <= max, `${e.key} 등급 ${e.tier}`);
      assert.ok(e.basis && e.basis.length > 3, `${e.key} 근거 없음`);
    }
    assert.equal(tables[name].tiers.length, max);
  }
  const byKey = new Map(tables.gpu.entries.map((e) => [e.key, e]));
  for (const e of tables.gpu.entries.filter((x) => x.key.endsWith(' laptop'))) {
    const base = byKey.get(e.key.replace(/ laptop$/, ''));
    assert.equal(e.tier, Math.max(1, base.tier - 1), e.key);
    assert.equal(e.mobile, true);
  }
});

test('GPU: 단일 모델·대안 표기(낮은 쪽)·상표 기호', () => {
  assert.equal(p('Intel Core i5-6500', 'NVIDIA GeForce GTX 1060 6 GB').gpu_tier, 9);
  assert.equal(p('Intel Core i5-6500', 'GeForce GTX 1060 6 GB or Radeon RX 590').gpu_tier, 9);
  assert.equal(p('Intel Core i5-6500', 'GeForce GTX 1060 or Radeon RX 480 or Intel Arc A380').gpu_tier, 6); // 낮은 쪽
  assert.equal(p('Intel® Core™ i7-8700K', 'NVIDIA® GTX™ 1080 Ti').gpu_tier, 12);
  assert.equal(p('x', 'NVIDIA 970 or equivalent').gpu_tier, 8);
  assert.equal(p('x', 'GTX 1660S').gpu_tier, 10);
});

test('GPU: 노트북은 한 단계 낮게', () => {
  assert.equal(p('x', 'GeForce RTX 3060 Laptop GPU').gpu_tier, 10);
  assert.equal(p('x', 'GeForce GTX 970M').gpu_tier, 7);
});

test('GPU: 모델 없는 저사양 표기는 최저 등급 + low_spec', () => {
  for (const g of ['Integrated', 'DirectX 11 compatible video card', '512MB', 'Graphics card with DX10 capabilities']) {
    const r = p('Intel Core i5-6500', g);
    assert.equal(r.gpu_tier, 1, g); assert.equal(r.low_spec, true, g);
  }
  assert.equal(p('x', 'Intel HD Graphics 630').low_spec, false); // 모델이 있으면 low_spec 아님
  assert.equal(p('x', 'Intel HD Graphics 630').gpu_tier, 2);
  assert.equal(p('x', 'TBD').gpu_tier, null);
  assert.equal(p('x', '1024x768 pixel over').gpu_tier, null);
});

test('CPU: 세대·급 읽기', () => {
  assert.equal(p('Intel Core i7-6700 or AMD Ryzen 5 1600', 'x').cpu_tier, 5); // 낮은 쪽
  assert.equal(p('Intel Core i5-1135G7', 'x').cpu_tier, 7); // 11세대 모바일
  assert.equal(p('Intel Core i3-10100F', 'x').cpu_tier, 6);
  assert.equal(p('AMD Ryzen 5 3600', 'x').cpu_tier, 6);
  assert.equal(p('AMD Ryzen 5600G', 'x').cpu_tier, 7); // 급 생략 표기
  assert.equal(p('Intel i5 6세대 또는 AMD Ryzen 데스크톱 프로세서', 'x').cpu_tier, 5); // "6세대" 표기
  assert.equal(p('Intel Core 2 Duo E8400', 'x').cpu_tier, 1);
  assert.equal(p('Intel Core 2 Duo E4600 2.4ghz or Athlon 64 x2 Dual Core 5200', 'x').cpu_tier, 1); // "Core 5200" 오인 방지
});

test('CPU: 모델 없는 표기', () => {
  const r = p('2.4 GHz Dual Core', 'GeForce GTX 1060');
  assert.equal(r.cpu_tier, 1); assert.equal(r.low_spec, true);
  const c = p('Intel Core i5', 'GeForce GTX 1060');
  assert.equal(c.cpu_tier, 4); assert.equal(c.low_spec, false); assert.equal(c.detail.cpu.kind, 'class-only'); assert.equal(c.confidence, 'medium');
  assert.equal(p('TBD', 'GeForce GTX 1060').cpu_tier, null);
});

test('RAM·저장 공간', () => {
  assert.equal(p('x', 'x', '8 GB RAM').ram_gb, 8);
  assert.equal(p('x', 'x', '1500 MB RAM').ram_gb, 1.5);
  assert.equal(p('x', 'x', '8 MB RAM').ram_gb, 8); // 단위 오타
  assert.equal(p('x', 'x', '8 MB RAM').detail.ram, 'typo-fixed');
  assert.equal(p('x', 'x', '8 GB RAM', '1.5 TB 사용 가능 공간').storage_gb, 1536);
  assert.equal(p('x', 'x', '8 GB RAM', '500 MB 사용 가능 공간').storage_gb, 0.5);
  assert.equal(p('x', 'x', '').ram_gb, null);
});

test('칸 나누기: 값 안의 " / "와 영어 칸 이름, 권장 라벨 줄', () => {
  const r = parseSpecText('권장: / 운영 체제: Windows 10 / Processor: Intel Core i5-6600 / Memory: 16 GB RAM / Graphics: NVIDIA GTX 1060 / AMD RX 480 / Storage: 40 GB available space', tables);
  assert.deepEqual(r.cpu, { intel: 5 }); assert.deepEqual(r.gpu, { nvidia: 9, amd: 9 }); assert.equal(r.ram_gb, 16); assert.equal(r.storage_gb, 40);
  assert.equal(parseSpecText('', tables), null);
  assert.equal(parseSpecText(null, tables), null);
});

test('confidence: 모델·RAM이 다 있으면 high', () => {
  assert.equal(p('Intel Core i5-6500', 'GeForce GTX 1060').confidence, 'high');
  assert.equal(p('TBD', 'GeForce GTX 1060').confidence, 'low');
});

test('GPU: 8800·9600처럼 4자리 옛 시리즈는 RTX로 읽지 않는다', () => {
  assert.equal(p('x', 'NVIDIA 9600GT or ATI Radeon HD 5000+ or better').gpu_tier, 2); // 9600 GT는 2, HD 5000 이상(가까운 HD 4890)은 3 → 낮은 쪽
  assert.equal(p('x', 'NVIDIA 9600GT').gpu_tier, 2);
  assert.equal(p('x', 'GeForce 8800 GT').gpu_tier, 2);
  assert.equal(p('x', 'NVIDIA GeForce 2080RTX').gpu_tier, 12);
});

test('대안 표기는 제조사별로 보존된다', () => {
  assert.deepEqual(p0('Intel Core i5-6500 or AMD Ryzen 5 1600', 'NVIDIA GeForce GTX 1060 or AMD Radeon RX 6600 XT or Intel Arc A380').cpu, { intel: 5, amd: 5 });
  assert.deepEqual(p0('x', 'NVIDIA GeForce GTX 1060 or AMD Radeon RX 6600 XT or Intel Arc A380').gpu, { nvidia: 9, amd: 12, intel: 6 });
  assert.deepEqual(p0('Intel Core i7-8700K', 'NVIDIA GeForce GTX 1080 Ti').gpu, { nvidia: 12 }); // 제조사 하나만 적히면 그 하나만
  assert.deepEqual(p0('Intel Core i7-8700K', 'NVIDIA GeForce GTX 1080 Ti').cpu, { intel: 7 });
  assert.deepEqual(p0('x', 'GeForce GTX 1060 or GeForce GTX 1650 or Radeon RX 580').gpu, { nvidia: 7, amd: 9 }); // 같은 제조사 안의 대안은 낮은 쪽
  assert.equal(highestTier(p0('x', 'GTX 1060 or RX 6600 XT').gpu), 12);
});

test('low_spec·판정 불가 표기의 구조', () => {
  assert.deepEqual(p0('2.4 GHz Dual Core', 'Integrated').cpu, { any: 1 });
  assert.deepEqual(p0('2.4 GHz Dual Core', 'Integrated').gpu, { any: 1 });
  assert.equal(p0('TBD', 'TBD').cpu, null);
  assert.equal(p0('TBD', 'TBD').gpu, null);
});
