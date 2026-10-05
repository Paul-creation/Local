// scripts/review-spec-parse.mjs
// 사양 파서 검증: 무작위 게임을 파서와 Haiku가 각각 판정해서, 둘이 다른 항목만 검수용 CSV로 뽑는다
// 실행: node --env-file=.env.local scripts/review-spec-parse.mjs                (예상 비용만 — AI 안 부름)
//       node --env-file=.env.local scripts/review-spec-parse.mjs --run          (AI 호출 후 docs/pc-spec-review.csv 저장, DB는 안 씀)
//       --n 100    게임 수 (기본 100)   --seed 7   무작위 시드 (기본 7)   --out 파일.csv
// - AI는 파서의 결과를 보지 않는다: 같은 칸 원문(프로세서·그래픽·메모리·저장 공간)과 등급표 설명만 받고 따로 판정
// - Haiku, 10개 게임씩 묶어 1번. scripts/는 CLAUDE.md 규칙상 guardedClaudeFetch 예외 (사이트 하루 AI 상한을 쓰지 않도록 직접 호출)
// - 누적 비용이 MAX_COST_USD를 넘으면 멈춤. 실제 사용 토큰으로 비용을 계산해 마지막에 출력
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { parseSpecText, splitFields } from '../app/lib/specParse.ts';

const RUN = process.argv.includes('--run');
const arg = (name, d) => (process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : d);
const N = Number(arg('--n', 100));
let seed = Number(arg('--seed', 7));
const OUT = arg('--out', 'docs/pc-spec-review.csv');
const CACHE = 'scripts/.cache/spec-review-ai.json'; // AI 응답 저장 — --reuse면 다시 부르지 않고 이 응답으로 비교만 (비용 0)
const REUSE = process.argv.includes('--reuse');
const BATCH = 10;
const MAX_COST_USD = 1;
const MODEL = 'claude-haiku-4-5-20251001';
const PRICE = { input: 1 / 1e6, output: 5 / 1e6 }; // Haiku 4.5 ($/토큰)

const tables = { gpu: JSON.parse(fs.readFileSync('data/pc-spec/gpu-tiers.json', 'utf8')), cpu: JSON.parse(fs.readFileSync('data/pc-spec/cpu-tiers.json', 'utf8')) };
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const ladder = (t) => t.tiers.map((x) => `  ${x.tier}: ${x.meaning} — 예) ${x.examples}`).join('\n');

const PROMPT_HEAD = `너는 PC 게임 요구 사양을 읽어 CPU·GPU 등급을 매기는 사람이야. 아래 등급표를 기준으로 각 사양 항목을 판정해.

[GPU 등급 1~15]
${ladder(tables.gpu)}
- 노트북 GPU(Laptop·Mobile·Max-Q·M 접미사)는 같은 이름의 데스크톱보다 한 단계 낮게(최저 1)
[CPU 등급 1~8]
${ladder(tables.cpu)}
- Intel Core i-시리즈는 모델 번호로 세대를 읽어(i5-6500 = 6세대, i7-12700 = 12세대) 세대와 i3/i5/i7/i9 급에서 등급을 정해
- 세대 없이 급만 적은 "Intel Core i5"는 옛 세대 기준(i3 3·i5 4·i7 5)

[규칙]
- "A 또는 B"(or, 또는, /, 쉼표로 나열)처럼 대안이 있으면 각각 등급을 매긴 뒤 가장 낮은 값을 써 (제작사가 둘 중 하나면 된다고 적은 것이므로 요구치는 낮은 쪽)
- 표에 정확히 없는 모델은 같은 계열에서 가장 가까운 모델로 추정해
- 모델명이 없는 저사양 표기(내장 그래픽만, DirectX/OpenGL 호환만, VRAM 용량만, GHz·코어 수만)는 등급 1이고 cpu_low 또는 gpu_low를 true로
- 칸이 비었거나 TBD·의미 없는 문장·해상도만 적힌 경우는 등급 null
- ram_gb: 메모리 칸의 첫 용량을 GB로 (MB는 /1024, 소수 1자리). 단위가 명백한 오타(8 MB RAM)면 GB로 읽어. 없으면 null
- storage_gb: 저장 공간 칸의 첫 용량을 GB로 (TB는 ×1024, MB는 /1024). 없으면 null

[출력] JSON만, 설명 없이:
{"specs":[{"i":번호,"cpu_tier":숫자|null,"gpu_tier":숫자|null,"ram_gb":숫자|null,"storage_gb":숫자|null,"cpu_low":true|false,"gpu_low":true|false}, ...]}

[판정할 사양]
`;

const estimateTokens = (text) => {
  const nonAscii = (text.match(/[^\x00-\x7f]/g) || []).length;
  return Math.ceil((text.length - nonAscii) / 4 + nonAscii);
};

async function askHaiku(prompt) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: MODEL, max_tokens: 4000, messages: [{ role: 'user', content: prompt }] }),
    signal: AbortSignal.timeout(120000),
  });
  const json = await res.json();
  if (json.error) throw new Error(`HTTP ${res.status} ${json.error.message}`);
  if (json.stop_reason === 'max_tokens') throw new Error('답이 중간에 잘림 (max_tokens)');
  const text = (json.content || []).map((c) => c.text || '').join('');
  const parsed = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
  const u = json.usage || {};
  return { rows: parsed.specs || [], cost: (u.input_tokens || 0) * PRICE.input + (u.output_tokens || 0) * PRICE.output, usage: u };
}

// 게임 N개를 무작위로 (최소 사양이 있는 숨기지 않은 게임)
const games = [];
for (let from = 0; ; from += 1000) {
  const { data, error } = await supabase.from('games').select('id, name, min_spec, recommended_spec').eq('hidden', false).not('min_spec', 'is', null).range(from, from + 999);
  if (error) throw error;
  games.push(...data);
  if (data.length < 1000) break;
}
const picked = [];
const used = new Set();
while (picked.length < Math.min(N, games.length)) { const i = Math.floor(rnd() * games.length); if (!used.has(i)) { used.add(i); picked.push(games[i]); } }

// 판정할 항목(게임 × 최소/권장)
const items = [];
for (const g of picked) for (const [kind, raw] of [['최소', g.min_spec], ['권장', g.recommended_spec]]) {
  if (!raw || !raw.trim()) continue;
  const f = splitFields(raw);
  items.push({ game: g.name, kind, raw, fields: f, parser: parseSpecText(raw, tables) });
}
const fieldText = (f) => `CPU: ${f.cpu ?? '(칸 없음)'}\nGPU: ${f.gpu ?? '(칸 없음)'}\nRAM: ${f.ram ?? '(칸 없음)'}\n저장: ${f.storage ?? '(칸 없음)'}`;
const batches = [];
for (let i = 0; i < picked.length; i += BATCH) {
  const names = new Set(picked.slice(i, i + BATCH).map((g) => g.name));
  batches.push(items.filter((it) => names.has(it.game)));
}
const promptOf = (batch, offset) => PROMPT_HEAD + batch.map((it, k) => `[${offset + k}] ${it.game} (${it.kind})\n${fieldText(it.fields)}`).join('\n\n');

// 예상 비용
let off = 0, estIn = 0;
const prompts = batches.map((b) => { const p = promptOf(b, off); off += b.length; estIn += estimateTokens(p); return p; });
const estOut = items.length * 45;
const est = estIn * PRICE.input + estOut * PRICE.output;
console.log(`게임 ${picked.length}개 → 판정 항목 ${items.length}개(최소·권장), Haiku ${batches.length}번 호출`);
console.log(`예상 토큰 입력 약 ${estIn.toLocaleString()} · 출력 약 ${estOut.toLocaleString()} → 예상 비용 약 $${est.toFixed(3)} (한도 $${MAX_COST_USD})`);
if (!RUN && !REUSE) { console.log('\n예상 비용만 계산했어요. AI를 부르려면 --run (저장된 응답으로 비교만 하려면 --reuse)'); process.exit(0); }

// 호출
const ai = new Map();
let total = 0, inTok = 0, outTok = 0;
off = 0;
if (REUSE) { for (const [i, r] of JSON.parse(fs.readFileSync(CACHE, 'utf8'))) ai.set(i, r); console.log(`저장된 AI 응답 ${ai.size}개로 비교만 (비용 0)`); }
for (let bi = 0; bi < batches.length && !REUSE; bi++) {
  if (total > MAX_COST_USD) { console.log(`⛔ 누적 $${total.toFixed(3)} > $${MAX_COST_USD} — 멈춤`); break; }
  const { rows, cost, usage } = await askHaiku(prompts[bi]);
  total += cost; inTok += usage.input_tokens || 0; outTok += usage.output_tokens || 0;
  rows.forEach((r) => ai.set(Number(r.i), r));
  console.log(`[${bi + 1}/${batches.length}] 입력 ${usage.input_tokens} · 출력 ${usage.output_tokens} (약 $${cost.toFixed(4)})`);
  off += batches[bi].length;
}

if (!REUSE) { fs.mkdirSync('scripts/.cache', { recursive: true }); fs.writeFileSync(CACHE, JSON.stringify([...ai])); }

// 비교 → CSV (다른 항목만)
const fmt = (s) => s ? `CPU ${s.cpu_tier ?? '-'} · GPU ${s.gpu_tier ?? '-'} · RAM ${s.ram_gb ?? '-'} · 저장 ${s.storage_gb ?? '-'} · low_spec ${s.low_spec}` : '-';
const num = (v) => (v == null ? null : Math.round(Number(v) * 10) / 10);
const csv = (v) => `"${String(v ?? '').replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`;
const rowsOut = [];
let idx = 0, compared = 0, missingAi = 0;
const diffStat = { cpu_tier: 0, gpu_tier: 0, ram_gb: 0, storage_gb: 0, low_spec: 0 };
const tierDiff = { 1: 0, 2: 0, '3+': 0, null: 0 }; // 등급 차이 크기별 (CPU·GPU 합산)
for (const b of batches) for (const it of b) {
  const r = ai.get(idx++);
  if (!r) { missingAi++; continue; }
  compared++;
  const P = it.parser;
  const A = { cpu_tier: num(r.cpu_tier), gpu_tier: num(r.gpu_tier), ram_gb: num(r.ram_gb), storage_gb: num(r.storage_gb), low_spec: !!(r.cpu_low || r.gpu_low) };
  const diffs = [];
  let size = 0;
  for (const k of ['cpu_tier', 'gpu_tier', 'ram_gb', 'storage_gb']) {
    if ((P[k] ?? null) === (A[k] ?? null)) continue;
    const d = P[k] == null || A[k] == null ? 99 : Math.abs(P[k] - A[k]); // 한쪽만 null이면 99(판정 여부 자체가 다름)
    diffs.push(k.endsWith('tier') ? `${k}(${d === 99 ? '한쪽 null' : '±' + d})` : k); diffStat[k]++; size = Math.max(size, d);
    if (k.endsWith('tier')) tierDiff[d === 99 ? 'null' : d >= 3 ? '3+' : d]++;
  }
  if (P.low_spec !== A.low_spec) { diffs.push('low_spec'); diffStat.low_spec++; size = Math.max(size, 1); }
  if (!diffs.length) continue;
  rowsOut.push({ size, cells: [it.game, it.kind, `CPU: ${it.fields.cpu ?? '-'} | GPU: ${it.fields.gpu ?? '-'} | RAM: ${it.fields.ram ?? '-'} | 저장: ${it.fields.storage ?? '-'}`, fmt(P), fmt({ ...A }), diffs.join(', ')] });
}
rowsOut.sort((a, b) => b.size - a.size); // 차이가 큰 행이 위로
const lines = [['게임명', '구분', '원문', '파서 결과', 'AI 결과', '차이 항목'].map(csv).join(','), ...rowsOut.map((r) => r.cells.map(csv).join(','))];
fs.writeFileSync(OUT, '﻿' + lines.join('\r\n') + '\r\n');
console.log(`\n비교한 항목 ${compared}개 (AI 응답 없음 ${missingAi}) → 다른 항목 ${lines.length - 1}행 → ${OUT}`);
console.log('항목별 차이:', JSON.stringify(diffStat));
console.log('등급 차이 크기(CPU·GPU 합산):', JSON.stringify(tierDiff));
console.log(`실제 AI 비용: 입력 ${inTok.toLocaleString()} · 출력 ${outTok.toLocaleString()} 토큰 → 약 $${total.toFixed(4)}`);
