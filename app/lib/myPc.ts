// 내 PC 사양 — 브라우저(localStorage)에만 저장하는 값의 모양·검증·WebGL 렌더러 이름 정리 (순수 함수, 다른 파일을 가져오지 않는다)
// 저장 모양: { v: 2, tv: 2, gpu: { key, name, vendor, tier }, cpu: { key, name, vendor, tier }, ram: 8 }
// 부품은 고른 시점의 제조사·등급을 같이 저장해서, 판정할 때 등급표(큰 JSON)를 내려받지 않는다
// tv = 저장할 때의 등급표 버전(specTablesVersion.ts). 지금 버전과 다르면 저장된 부품 key로 등급을 다시 계산하고(refreshMyPc),
//   key가 등급표에서 사라졌으면 미입력으로 돌린다. 예전 모양(v: 1, tv 없음)은 tv 0으로 읽어 같은 길로 다시 계산한다
// 값이 없거나 모양이 깨져 있으면 null (= 미입력). 서버로는 보내지 않는다

export const MY_PC_KEY = 'my-pc-spec';
export const RAM_CHOICES = [4, 8, 16, 32, 64] as const;
const VENDORS = ['nvidia', 'amd', 'intel'];

export type MyPart = { key: string; name: string; vendor: 'nvidia' | 'amd' | 'intel'; tier: number };
export type MyPc = { v: 2; tv: number; gpu: MyPart; cpu: MyPart; ram: number };

function parsePart(p: unknown): MyPart | null {
  if (!p || typeof p !== 'object') return null;
  const o = p as Record<string, unknown>;
  if (typeof o.key !== 'string' || !o.key || typeof o.name !== 'string' || !o.name) return null;
  if (typeof o.vendor !== 'string' || !VENDORS.includes(o.vendor)) return null;
  if (typeof o.tier !== 'number' || !Number.isInteger(o.tier) || o.tier < 1 || o.tier > 100) return null;
  return { key: o.key, name: o.name, vendor: o.vendor as MyPart['vendor'], tier: o.tier };
}

// 저장된 문자열 → MyPc. 비었거나 깨졌으면 null
export function parseMyPc(raw: string | null | undefined): MyPc | null {
  if (!raw) return null;
  let o: unknown;
  try { o = JSON.parse(raw); } catch { return null; }
  if (!o || typeof o !== 'object') return null;
  const r = o as Record<string, unknown>;
  const gpu = parsePart(r.gpu);
  const cpu = parsePart(r.cpu);
  if (!gpu || !cpu || (r.v !== 1 && r.v !== 2)) return null;
  if (typeof r.ram !== 'number' || !(RAM_CHOICES as readonly number[]).includes(r.ram)) return null;
  const tv = r.v === 2 && typeof r.tv === 'number' && Number.isInteger(r.tv) && r.tv >= 0 ? r.tv : 0; // v1·깨진 tv는 0 = 항상 다시 계산
  return { v: 2, tv, gpu, cpu, ram: r.ram };
}

export const serializeMyPc = (pc: MyPc) => JSON.stringify(pc);

// 등급표 버전이 달라졌을 때: 저장된 부품 key로 제조사·등급을 다시 읽는다. key가 등급표에 없으면 null(미입력으로 처리)
export type TableEntry = { key: string; name: string; vendor: string; tier: number };
export function refreshMyPc(pc: MyPc, tables: { gpu: readonly TableEntry[]; cpu: readonly TableEntry[] }, tablesVersion: number): MyPc | null {
  const re = (part: MyPart, list: readonly TableEntry[]): MyPart | null => {
    const e = list.find((x) => x.key === part.key);
    return e && VENDORS.includes(e.vendor) ? { key: e.key, name: e.name, vendor: e.vendor as MyPart['vendor'], tier: e.tier } : null;
  };
  const gpu = re(pc.gpu, tables.gpu);
  const cpu = re(pc.cpu, tables.cpu);
  return gpu && cpu ? { v: 2, tv: tablesVersion, gpu, cpu, ram: pc.ram } : null;
}

// 판정 함수(specJudge.UserPc)에 넘기는 모양
export const toUserPc = (pc: MyPc) => ({ cpu: { vendor: pc.cpu.vendor, tier: pc.cpu.tier }, gpu: { vendor: pc.gpu.vendor, tier: pc.gpu.tier }, ram_gb: pc.ram });

// WebGL UNMASKED_RENDERER_WEBGL 문자열 → 등급표에서 찾을 이름 후보 (찾을 수 없으면 null)
// "ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)" → "NVIDIA GeForce RTX 3060"
// 소프트웨어 렌더러·가상 GPU·Apple GPU는 판정에 쓸 수 없으니 null
export function rendererToText(renderer: string | null | undefined): string | null {
  if (!renderer) return null;
  let s = renderer.trim();
  if (/swiftshader|llvmpipe|softpipe|software|basic render|microsoft basic|virtualbox|vmware|parallels|^apple\b|\bapple (gpu|m\d)/i.test(s)) return null;
  const angle = /^ANGLE\s*\((.*)\)\s*$/i.exec(s);
  if (angle) {
    const parts = angle[1].split(',').map((x) => x.trim());
    s = parts.length >= 2 ? parts[1] : parts[0]; // [제조사, 렌더러, API]
  }
  s = s
    .replace(/\s*(?:Direct3D\d*\w*|OpenGL\s*(?:ES)?[\d. ]*|Metal)\b.*$/i, '') // API 이름 이후 전부
    .replace(/\s+vs_\d_\d\s+ps_\d_\d.*$/i, '')
    .replace(/\/(?:PCIe|PCI|integrated).*$/i, '') // Linux: "GeForce GTX 1050/PCIe/SSE2"
    .replace(/\s*\(0x[0-9a-f]+\)\s*/i, ' ') // "(0x00002504)"
    .replace(/\s+/g, ' ')
    .trim();
  return s.length >= 3 ? s : null;
}
