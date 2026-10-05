// 게임 PC 사양 텍스트(games.min_spec·recommended_spec) → CPU 등급·GPU 등급·RAM·저장 공간
// 순수 함수 — 다른 파일을 가져오지 않는다 (스크립트·테스트·브라우저에서 같은 코드를 쓰려고). 등급표는 호출하는 쪽이 넘긴다
// 등급표: data/pc-spec/gpu-tiers.json · cpu-tiers.json (세대·급 기준 자체 등급, docs/pc-spec-checker-plan.md)
// 규칙
// - 칸 이름(프로세서·그래픽·메모리·저장 공간)으로 나눈 뒤, 상표 기호(®™)를 지우고 모델명을 찾는다
// - "A 또는 B" 대안 표기는 둘 중 낮은 등급을 요구치로 본다 (제작사가 둘 중 하나면 된다고 적었으므로)
// - 모델명이 없는 저사양 표기(내장 그래픽·DirectX만·GHz만 등)는 최저 등급 + low_spec: true
// - 세대 없이 급만 적은 CPU("Intel Core i5")와 표에 없는 번호(가장 가까운 번호로 추정)는 confidence를 낮춘다

export type GpuEntry = { key: string; name: string; vendor: string; tier: number; mobile: boolean; basis: string };
export type CpuEntry = { key: string; name: string; vendor: string; family: string; gen: number | null; class: string | null; tier: number; basis: string; class_only?: boolean };
export type SpecTables = { gpu: { entries: GpuEntry[] }; cpu: { entries: CpuEntry[] } };

export type PartDetail = { kind: 'model' | 'class-only' | 'nearest' | 'low-spec' | 'unresolved' | 'missing'; keys: string[] };
export type ParsedSpec = {
  cpu_tier: number | null;
  gpu_tier: number | null;
  ram_gb: number | null;
  storage_gb: number | null;
  matched: { cpu: string | null; gpu: string | null }; // 칸 원문
  low_spec: boolean;
  confidence: 'high' | 'medium' | 'low';
  detail: { cpu: PartDetail; gpu: PartDetail; ram: 'ok' | 'typo-fixed' | 'missing'; storage: 'ok' | 'missing' };
};

// ── 텍스트 정리·칸 나누기 ──
export const cleanText = (s: string) =>
  s.replace(/[®™©]/g, '').replace(/\((?:R|TM|C)\)/gi, '').replace(/\bTM\b/g, '').replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim();

const CPU_LABEL = /^(프로세서|processor|cpu)/i;
const GPU_LABEL = /^(그래픽|graphics|video|gpu)/i;
const RAM_LABEL = /^(메모리|memory|ram|system memory)/i;
const STO_LABEL = /^(저장\s*공간|storage|hard drive|hard disk|hdd|disk|디스크)/i;

// "운영 체제: … / 프로세서: … / 그래픽: …" → 칸 이름별 값. 칸 이름처럼 보이지 않는 조각은 앞 칸에 이어 붙인다
export function splitFields(raw: string | null | undefined) {
  const out: { cpu: string | null; gpu: string | null; ram: string | null; storage: string | null } = { cpu: null, gpu: null, ram: null, storage: null };
  if (!raw) return out;
  const parts: { label: string; value: string }[] = [];
  for (const part of raw.split(' / ')) {
    const m = /^([^:：]{1,30})[:：]\s*(.*)$/.exec(part.trim());
    if (m && !/\d{2,}/.test(m[1]) && !/\b(?:or|또는)\b/i.test(m[1])) parts.push({ label: m[1].replace(/[*＊]/g, '').trim(), value: m[2] });
    else if (parts.length) parts[parts.length - 1].value += ' / ' + part.trim();
  }
  for (const { label, value } of parts) {
    const v = cleanText(value);
    if (CPU_LABEL.test(label) && out.cpu == null) out.cpu = v;
    else if (GPU_LABEL.test(label) && out.gpu == null) out.gpu = v;
    else if (RAM_LABEL.test(label) && out.ram == null) out.ram = v;
    else if (STO_LABEL.test(label) && out.storage == null) out.storage = v;
  }
  return out;
}

// "A or B" → [A, B]. 괄호 안의 "(or equivalent)"는 나누지 않는다
const splitAlternatives = (s: string) => s.split(/\s+or\s+|\s+또는\s+|\s*\/\s*|\s*;\s*|\s*,\s*|\s+and\s+|\s*\+\s*/i).map((x) => x.trim()).filter(Boolean);

// ── 등급표 색인 ──
type Index = { gpu: Map<string, GpuEntry>; cpu: Map<string, CpuEntry>; gpuByPrefix: Map<string, { n: number; e: GpuEntry }[]> };
const indexCache = new WeakMap<object, Index>();
export function buildIndex(t: SpecTables): Index {
  const hit = indexCache.get(t);
  if (hit) return hit;
  const gpu = new Map(t.gpu.entries.map((e) => [e.key, e] as const));
  const cpu = new Map(t.cpu.entries.map((e) => [e.key, e] as const));
  // 가까운 번호 추정용: 같은 계열(gtx·rtx·rx·hd 등) 안에서 숫자 순
  const gpuByPrefix = new Map<string, { n: number; e: GpuEntry }[]>();
  for (const e of t.gpu.entries) {
    if (e.mobile) continue;
    const m = /^(gtx|rtx|gts|gt|rx|hd|r[579]|x|mx|arc [ab]|vega)\s*(\d+)/.exec(e.key);
    if (!m) continue;
    const list = gpuByPrefix.get(m[1]) || [];
    list.push({ n: +m[2], e });
    gpuByPrefix.set(m[1], list);
  }
  const idx = { gpu, cpu, gpuByPrefix };
  indexCache.set(t, idx);
  return idx;
}

// ── GPU ──
type Hit<E> = { entry: E; kind: 'model' | 'class-only' | 'nearest' };

const MOBILE_WORD = /laptop|mobile|notebook|max-?q|mobility/i;

// 한 조각에서 GPU 모델 키 후보를 뽑는다 (여러 개일 수 있음: 앞에서부터 가장 구체적인 것)
function gpuKeysOf(piece: string): { key: string; mobile: boolean }[] {
  const s = piece.toLowerCase();
  const mobileWord = MOBILE_WORD.test(s);
  const out: { key: string; mobile: boolean }[] = [];
  const push = (key: string, mobile = false) => out.push({ key, mobile: mobile || mobileWord });
  const suffixes = (a?: string, b?: string) => [a, b].filter(Boolean).map((x) => ' ' + x!.toLowerCase()).join('');
  let m: RegExpExecArray | null;
  const isIntel = /\bintel\b|\buhd\b|\biris\b|\barc\b|hd graphics/.test(s);

  // NVIDIA
  const nvPrefix = (n: number) => (n >= 1600 && n < 1700) || (n >= 400 && n < 1100) ? 'gtx' : n >= 2000 ? 'rtx' : 'gtx';
  const sfx = (a?: string, b?: string) => [a, b].filter(Boolean).map((x) => (x === 's' ? ' super' : ' ' + x!)).join('');
  if ((m = /\b(gtx|rtx|gts|gt)\s*-?\s*(\d{3,4})([mq]?)(?:\s*(ti|super|s)\b)?(?:\s*(ti|super)\b)?/.exec(s))) push(`${m[1]} ${m[2]}${sfx(m[4], m[5])}`, m[3] === 'm' || m[3] === 'q');
  else if ((m = /\b(\d{3,4})\s*(gtx|rtx|gts|gt)\b/.exec(s)) && /geforce|nvidia|gtx|rtx/.test(s)) { if (+m[1] >= 6000 || +m[1] < 400) { push(`${m[1]} ${m[2]}`); push(m[1]); } else push(`${m[2]} ${m[1]}`); } // 470 GTX·2080RTX는 접두사가 뒤에, 9600GT·8800GTS는 옛 시리즈
  else if ((m = /\b(?:gtx\s*)?titan\s*(x|xp|rtx|black|z)?\b/.exec(s))) push(/rtx/.test(s) ? 'titan rtx' : /xp/.test(s) ? 'titan xp' : /gtx/.test(s) ? 'gtx titan' + (m[1] === 'x' ? ' x' : '') : 'titan ' + (m[1] || 'x'));
  else if ((m = /\bmx\s*-?(\d{3})\b/.exec(s))) push(`mx${m[1]}`);
  else if ((m = /\b(?:geforce|nvidia)\s*(?:gs\s*)?(\d{3,4})([mq]?)(?:\s*(ti|super|s)\b)?\s*(gtx|gts|gt|gs)?\b/.exec(s))) {
    const n = +m[1];
    if (m[2] === 'm') push(`${m[1]}m`, true);
    else if (n >= 400 && n < 6000) push(`${m[4] && m[4] !== 'gs' ? m[4] : nvPrefix(n)} ${m[1]}${sfx(m[3])}`, m[2] === 'q'); // 470·970·1060·2080·4090처럼 gtx/rtx 접두사가 생략된 표기
    else { if (m[4]) push(`${m[1]} ${m[4]}`); push(m[1]); } // 6000번대 이상 4자리(8800 GT·9600 GT)와 세 자리 이하(GT 240 등)는 옛 시리즈
  } else if (/\bgeforce\s*(?:fx|[234]\b|[234]\s|[5-7]\d{3}\b)/.test(s)) push('6200');
  // AMD
  if ((m = /\brx\s*-?\s*(\d{3,4})(m?)(?:\s*(xtx|xt|gre))?\b/.exec(s))) push(`rx ${m[1]}${m[3] ? ' ' + m[3] : ''}`, m[2] === 'm');
  else if ((m = /\bradeon\s*(\d{4})\s*(xtx|xt|gre)\b/.exec(s))) push(`rx ${m[1]} ${m[2]}`);
  else if ((m = /\br9\s*(fury x|fury|nano|295x2)\b/.exec(s))) push(`r9 ${m[1]}`);
  else if ((m = /\br([579])\s*-?\s*(\d{3}x?)\b/.exec(s))) push(`r${m[1]} ${m[2]}`);
  else if ((m = /\bradeon\s*vii\b|\bradeon\s*7\b/.exec(s))) push('radeon vii');
  else if ((m = /\bradeon\s*(\d{4})\b/.exec(s))) { push(`hd ${m[1]}`); push(`rx ${m[1]}`); }
  else if ((m = /\bradeon\s*(\d{3})\b/.exec(s)) && +m[1] >= 200) push(`r9 ${m[1]}`);
  else if ((m = /\bvega\s*(\d{1,2})\b/.exec(s))) push(`vega ${m[1]}`);
  else if (!isIntel && (m = /\bhd\s*-?\s*(\d{4})\b/.exec(s))) push(`hd ${m[1]}`);
  else if ((m = /\b(?:radeon\s*)?(\d{3}m|8060s)\b/.exec(s)) && /radeon|amd|ryzen/.test(s)) push(m[1]);
  else if ((m = /\b(?:ati\s*)?(?:radeon\s*)?x\s?(\d{3,4})\b/.exec(s)) && /ati|radeon/.test(s)) push(`x${m[1]}`);
  // Intel
  if ((m = /\barc\s*(?:pro\s*)?([ab]\d{3})\b/.exec(s))) push(`arc ${m[1]}`);
  else if (/\barc\b.*graphics|\barc graphics\b/.test(s)) push('arc graphics');
  else if (/\biris\s*xe\b/.test(s)) push('iris xe');
  else if ((m = /\biris\s*(plus|pro)?\s*(?:graphics)?\s*(\d{3,4})?/.exec(s)) && /iris/.test(s)) { if (m[2]) push(`iris ${m[1] || 'graphics'} ${m[2]}`); push(m[1] === 'plus' ? 'iris plus' : 'iris graphics 540'); }
  else if ((m = /\buhd\s*(?:graphics)?\s*(\d{3,4})?/.exec(s))) { if (m[1]) push(`uhd graphics ${m[1]}`); push('uhd graphics'); }
  else if ((m = /\b(?:intel\s*)?hd\s*graphics\s*(\d{3,4})?|\bintel\s*hd\s*(\d{3,4})?/.exec(s))) { const n = m[1] || m[2]; if (n) push(`hd graphics ${n}`); push('hd graphics'); }
  if (!out.length && /\bradeon graphics\b|\bamd radeon\(?tm\)? graphics\b/.test(s)) push('radeon graphics');
  return out;
}

function gpuLookup(idx: Index, key: string, mobile: boolean): Hit<GpuEntry> | null {
  if (mobile) {
    const lap = idx.gpu.get(`${key} laptop`);
    if (lap) return { entry: lap, kind: 'model' };
  }
  const base = idx.gpu.get(key);
  if (base) {
    // 노트북인데 별도 항목이 없으면 데스크톱보다 한 단계 낮게
    if (mobile && !base.mobile) return { entry: { ...base, key: `${base.key} laptop`, name: `${base.name} Laptop`, tier: Math.max(1, base.tier - 1), mobile: true }, kind: 'model' };
    return { entry: base, kind: 'model' };
  }
  // 표에 없는 번호 → 같은 계열에서 가장 가까운 번호
  const m = /^(gtx|rtx|gts|gt|rx|hd|r[579]|x|mx|arc [ab]|vega)\s*(\d+)/.exec(key);
  if (m) {
    const list = idx.gpuByPrefix.get(m[1]);
    if (list?.length) {
      const n = +m[2];
      const near = list.reduce((a, b) => (Math.abs(b.n - n) < Math.abs(a.n - n) ? b : a));
      if (Math.abs(near.n - n) <= (n >= 1000 ? 150 : 60)) {
        const e = mobile ? { ...near.e, tier: Math.max(1, near.e.tier - 1), mobile: true } : near.e;
        return { entry: e, kind: 'nearest' };
      }
    }
  }
  return null;
}

const GPU_LOW = /\b\d+\s?m\b|integrated|내장|onboard|on-board|igpu|\bdx\s?\d|direct\s?x|\bshader|open\s?gl|vulkan|\d+\s?(?:mb|gb)\b|vram|video (?:card|memory|ram)|graphics (?:card|hardware|processor)|compatible|호환|\bgpu\b|dedicated|capable|support/i;
const CPU_LOW = /ghz|mhz|dual[- ]?core|quad[- ]?core|multi[- ]?core|\d[- ]?core|processor|cpu|x86|x64|64[- ]?bit|sse|intel or amd|\bany\b|듀얼|쿼드|코어|프로세서/i;
const RESOLUTION = /\d{3,4}\s*[x×]\s*\d{3,4}/;

function parseGpu(text: string | null, idx: Index): { tier: number | null; low: boolean; detail: PartDetail } {
  if (!text) return { tier: null, low: false, detail: { kind: 'missing', keys: [] } };
  const hits: Hit<GpuEntry>[] = [];
  for (const piece of splitAlternatives(text)) {
    for (const { key, mobile } of gpuKeysOf(piece)) {
      const h = gpuLookup(idx, key, mobile);
      if (h) { hits.push(h); break; }
    }
  }
  if (hits.length) {
    const min = hits.reduce((a, b) => (b.entry.tier < a.entry.tier ? b : a));
    return { tier: min.entry.tier, low: false, detail: { kind: hits.every((h) => h.kind === 'model') ? 'model' : 'nearest', keys: hits.map((h) => h.entry.key) } };
  }
  if (!RESOLUTION.test(text) && GPU_LOW.test(text)) return { tier: 1, low: true, detail: { kind: 'low-spec', keys: [] } };
  return { tier: null, low: false, detail: { kind: 'unresolved', keys: [] } };
}

// ── CPU ──
function cpuKeysOf(piece: string): { key: string; kind: 'model' | 'class-only' }[] {
  const s = piece.toLowerCase();
  const out: { key: string; kind: 'model' | 'class-only' }[] = [];
  let m: RegExpExecArray | null;
  // Core Ultra·새 Core 표기
  if ((m = /core\s*ultra\s*([579])\b/.exec(s))) out.push({ key: `intel core ultra ${m[1]}`, kind: 'model' });
  else if ((m = /\bcore\s+([57])\s+(?:processor\s*)?\d{3}[a-z]{0,2}\b/.exec(s))) out.push({ key: `intel core ${m[1]}`, kind: 'model' });
  // Intel Core i-시리즈
  else if ((m = /\bi([3579])\s*-?\s*(\d{3,5})([a-z]{0,2}\d?)\b/.exec(s))) {
    const cls = `i${m[1]}`, digits = m[2], suf = m[3];
    let gen = 0;
    if (digits.length === 5) gen = +digits.slice(0, 2);
    else if (digits.length === 4) gen = /^1[0-4]$/.test(digits.slice(0, 2)) && /^(g\d|p|u|h|hx|hk|hq|t)$/.test(suf) ? +digits.slice(0, 2) : +digits[0];
    else gen = 1;
    if (gen >= 1 && gen <= 14) out.push({ key: `intel core ${cls} gen${gen}`, kind: 'model' });
    else out.push({ key: `intel core ${cls}`, kind: 'class-only' });
  } else if ((m = /\bi([3579])\b/.exec(s)) && /core|intel|\bi[3579]\b/.test(s)) {
    // 세대를 "3rd gen"처럼 적었으면 그 세대로
    const g = /(\d{1,2})(?:st|nd|rd|th)\s*gen|(\d{1,2})\s*세대/.exec(s);
    const gen = g ? +(g[1] || g[2]) : 0;
    if (gen >= 1 && gen <= 14) out.push({ key: `intel core i${m[1]} gen${gen}`, kind: 'model' });
    else out.push({ key: `intel core i${m[1]}`, kind: 'class-only' });
  }
  // Ryzen (오타 Ryxen 허용)
  if (!out.length) {
    if ((m = /ry[zx]en\s*(?:ai\s*)?([3579])\s*(?:pro\s*)?(\d{4})[a-z0-9]*/.exec(s))) out.push({ key: `ryzen ${m[1]} gen${m[2][0]}`, kind: 'model' });
    else if ((m = /ry[zx]en\s*(\d)(\d)\d{2}[a-z0-9]*/.exec(s))) out.push({ key: `ryzen ${['0','3','3','3','5','5','5','7','7','9'][+m[2]] || '5'} gen${m[1]}`, kind: 'model' });
    else if ((m = /ry[zx]en\s*(?:ai\s*)?([3579])\b/.exec(s))) out.push({ key: `ryzen ${m[1]}`, kind: 'class-only' });
  }
  // 구형·기타
  if (!out.length) {
    const L = (key: string) => out.push({ key, kind: 'model' });
    if (/core\s*duo|core\s*solo/.test(s)) L('core 2 duo');
    else if (/core\s*2\s*quad|core2\s*quad|\bq[69]\d{3}\b/.test(s)) L('core 2 quad');
    else if (/core\s*2\s*extreme/.test(s)) L('core 2 extreme');
    else if (/core\s*2|core2/.test(s)) L('core 2 duo');
    else if (/pentium\s*4|\bp4\b/.test(s)) L('pentium 4');
    else if (/pentium\s*d\b/.test(s)) L('pentium d');
    else if (/pentium\s*gold|pentium\s*g[5-7]\d{3}/.test(s)) L('pentium gold');
    else if (/pentium\s*silver/.test(s)) L('pentium silver');
    else if (/pentium\s*g\d/.test(s)) L('pentium g');
    else if (/pentium/.test(s)) L('pentium dual-core');
    else if (/celeron\s*g\d/.test(s)) L('celeron g');
    else if (/celeron/.test(s)) L('celeron');
    else if (/\batom\b/.test(s)) L('atom');
    else if (/intel\s*n(\d{2,4})/.exec(s)) L(/intel\s*n4\d{3}/.test(s) ? 'pentium silver' : 'pentium gold');
    else if (/athlon\s*(?:64\s*)?x2/.test(s)) L('athlon x2');
    else if (/athlon\s*64/.test(s)) L('athlon 64');
    else if (/athlon\s*ii/.test(s)) L('athlon ii');
    else if (/athlon\s*(?:3000g|gold|silver)/.test(s)) L('athlon 3000g');
    else if (/athlon\s*200ge/.test(s)) L('athlon 200ge');
    else if (/athlon/.test(s)) L('athlon 64');
    else if (/sempron/.test(s)) L('sempron');
    else if ((m = /phenom\s*ii\s*x([2346])/.exec(s))) L(m[1] === '6' ? 'phenom ii x6' : m[1] === '2' ? 'phenom ii x2' : 'phenom ii x4');
    else if (/phenom/.test(s)) L('phenom');
    else if ((m = /\bfx[- ]?(\d)\d{3}/.exec(s))) L(`fx-${['4', '6', '8', '9'].includes(m[1]) ? m[1] : '8'}`);
    else if ((m = /\bamd\s*a(4|6|8|10|12)\b|\ba(4|6|8|10|12)[- ]\d{4}/.exec(s))) L(`amd a${m[1] || m[2]}`);
  }
  return out;
}

function parseCpu(text: string | null, idx: Index): { tier: number | null; low: boolean; detail: PartDetail } {
  if (!text) return { tier: null, low: false, detail: { kind: 'missing', keys: [] } };
  const hits: Hit<CpuEntry>[] = [];
  for (const piece of splitAlternatives(text)) {
    for (const { key, kind } of cpuKeysOf(piece)) {
      let e = idx.cpu.get(key);
      let k: Hit<CpuEntry>['kind'] = kind;
      if (!e && /^intel core i\d gen\d+$/.test(key)) { e = idx.cpu.get(key.replace(/ gen\d+$/, '')); k = 'class-only'; }
      if (!e && /^ryzen \d gen\d$/.test(key)) { e = idx.cpu.get(key.replace(/ gen\d$/, '')); k = 'class-only'; }
      if (e) { hits.push({ entry: e, kind: e.class_only ? 'class-only' : k }); break; }
    }
  }
  if (hits.length) {
    const min = hits.reduce((a, b) => (b.entry.tier < a.entry.tier ? b : a));
    return { tier: min.entry.tier, low: false, detail: { kind: hits.every((h) => h.kind === 'model') ? 'model' : 'class-only', keys: hits.map((h) => h.entry.key) } };
  }
  if (CPU_LOW.test(text) && !/\btbd\b/i.test(text)) return { tier: 1, low: true, detail: { kind: 'low-spec', keys: [] } };
  return { tier: null, low: false, detail: { kind: 'unresolved', keys: [] } };
}

// ── RAM·저장 공간 ──
const round1 = (n: number) => Math.round(n * 10) / 10;
function parseSize(text: string | null): { gb: number; unit: string; raw: number } | null {
  if (!text) return null;
  const m = /(\d+(?:[.,]\d+)?)\s*(tb|gb|g|mb|m)\b/i.exec(text);
  if (!m) return null;
  const n = parseFloat(m[1].replace(',', '.'));
  const unit = m[2].toLowerCase();
  const gb = unit === 'tb' ? n * 1024 : unit.startsWith('m') ? n / 1024 : n;
  return { gb, unit, raw: n };
}

function parseRam(text: string | null): { gb: number | null; detail: 'ok' | 'typo-fixed' | 'missing' } {
  const s = parseSize(text);
  if (!s) return { gb: null, detail: 'missing' };
  // "8 MB RAM" 같은 단위 오타: MB인데 64 이하면 GB로 읽는다
  if (s.unit.startsWith('m') && s.raw <= 64) return { gb: s.raw, detail: 'typo-fixed' };
  return { gb: round1(s.gb), detail: 'ok' };
}

// ── 한 칸(최소 또는 권장)의 전체 판정 ──
export function parseSpecText(raw: string | null | undefined, tables: SpecTables): ParsedSpec | null {
  if (!raw || !raw.trim()) return null;
  const idx = buildIndex(tables);
  const f = splitFields(raw);
  const cpu = parseCpu(f.cpu, idx);
  const gpu = parseGpu(f.gpu, idx);
  const ram = parseRam(f.ram);
  const sto = parseSize(f.storage);
  const low = cpu.low || gpu.low;
  const clean = (d: PartDetail) => d.kind === 'model';
  const confidence = cpu.tier == null || gpu.tier == null ? 'low' : clean(cpu.detail) && clean(gpu.detail) && ram.gb != null ? 'high' : 'medium';
  return {
    cpu_tier: cpu.tier,
    gpu_tier: gpu.tier,
    ram_gb: ram.gb,
    storage_gb: sto ? round1(sto.gb) : null,
    matched: { cpu: f.cpu, gpu: f.gpu },
    low_spec: low,
    confidence,
    detail: { cpu: cpu.detail, gpu: gpu.detail, ram: ram.detail, storage: sto ? 'ok' : 'missing' },
  };
}

// "A 또는 B" 대안 검증용: 칸 안에서 인식된 부품과 등급을 모두 돌려준다 (충돌 검사 스크립트)
export function alternativesOf(kind: 'cpu' | 'gpu', text: string | null, tables: SpecTables): { piece: string; key: string; tier: number }[] {
  if (!text) return [];
  const idx = buildIndex(tables);
  const out: { piece: string; key: string; tier: number }[] = [];
  for (const piece of splitAlternatives(text)) {
    if (kind === 'gpu') {
      for (const { key, mobile } of gpuKeysOf(piece)) { const h = gpuLookup(idx, key, mobile); if (h) { out.push({ piece, key: h.entry.key, tier: h.entry.tier }); break; } }
    } else {
      for (const { key } of cpuKeysOf(piece)) { const e = idx.cpu.get(key); if (e && !e.class_only) { out.push({ piece, key: e.key, tier: e.tier }); break; } }
    }
  }
  return out;
}
