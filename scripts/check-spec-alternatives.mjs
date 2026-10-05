// scripts/check-spec-alternatives.mjs
// 등급표 검증: 게임 사양의 "A 또는 B" 대안 표기에서 같은 줄에 나온 부품끼리 등급 차이가 2단계 이상이면 충돌로 보고
// (제작사가 "A 또는 B"라고 적었다면 둘은 대략 같은 급이라는 뜻 — 등급표가 어긋났는지 알려 주는 단서)
// 판정 규칙이 "제조사 일치 비교"(app/lib/specJudge.ts)로 바뀐 뒤에는, 충돌이 실제 판정에 영향을 주는 경우만 따로 센다:
//   사용자는 요구 사양에 자기 제조사 항목이 있으면 그것과 비교하므로, 줄에 없는 제조사의 사용자만 "적힌 항목 중 가장 높은 등급"과 비교한다.
//   → 충돌의 등급 차이가 판정에 닿는 건 (1) 줄에 없는 제조사가 있고 (2) 그 제조사 부품 중 낮은 등급 ≤ 등급 < 높은 등급인 부품이 등급표에 있을 때뿐이다
// 실행: node --env-file=.env.local scripts/check-spec-alternatives.mjs [--md docs/pc-spec-tier-conflicts.md]   (DB 읽기만, 쓰지 않음)
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { splitFields, alternativesOf } from '../app/lib/specParse.ts';

const tables = { gpu: JSON.parse(fs.readFileSync('data/pc-spec/gpu-tiers.json', 'utf8')), cpu: JSON.parse(fs.readFileSync('data/pc-spec/cpu-tiers.json', 'utf8')) };
const MD = process.argv.includes('--md') ? process.argv[process.argv.indexOf('--md') + 1] : null;
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const games = [];
for (let from = 0; ; from += 1000) {
  const { data, error } = await supabase.from('games').select('name, min_spec, recommended_spec').eq('hidden', false).range(from, from + 999);
  if (error) throw error;
  games.push(...data);
  if (data.length < 1000) break;
}

const VENDORS = { gpu: ['nvidia', 'amd', 'intel'], cpu: ['intel', 'amd'] };
const partsOf = (kind, vendor) => tables[kind].entries.filter((e) => e.vendor === vendor && !e.mobile && !e.class_only);
const ALT = / or | 또는 |\//i; // "대안 표기가 있는 줄" 기준 (조사 문서의 232개와 같은 기준)
const result = {};
for (const kind of ['gpu', 'cpu']) for (const which of ['min', 'rec']) {
  const r = { lines: 0, parsed: 0, conflicts: [], exact: 0, cross: 0, affected: [] };
  for (const g of games) {
    const text = splitFields(which === 'min' ? g.min_spec : g.recommended_spec)[kind];
    if (!text || !ALT.test(text)) continue;
    r.lines++;
    const alts = alternativesOf(kind, text, tables);
    if (alts.length < 2) continue;
    r.parsed++;
    const tiers = alts.map((a) => a.tier);
    const diff = Math.max(...tiers) - Math.min(...tiers);
    if (diff === 0) r.exact++;
    if (diff >= 2) {
      r.conflicts.push({ game: g.name, text, alts, diff });
      // 제조사별로 접은 등급 (같은 제조사 안의 대안은 낮은 쪽)
      const vt = {};
      for (const a of alts) vt[a.vendor] = Math.min(vt[a.vendor] ?? 99, a.tier);
      const lo = Math.min(...Object.values(vt)), hi = Math.max(...Object.values(vt));
      if (hi - lo < 2) continue; // 같은 제조사 안의 차이뿐 — 새 규칙에서는 낮은 쪽을 쓰므로 등급표 충돌이 아님
      r.cross++;
      const hit = VENDORS[kind].filter((v) => vt[v] == null && partsOf(kind, v).some((e) => e.tier >= lo && e.tier < hi)); // 줄에 없는 제조사 중 영향받는 쪽
      if (hit.length) r.affected.push({ game: g.name, text, vt, hit });
    }
  }
  result[`${kind}-${which}`] = r;
}

for (const [k, r] of Object.entries(result)) {
  const intel = k.startsWith('gpu') ? r.conflicts.filter((c) => c.alts.some((a) => /^(arc|hd graphics|uhd|iris)/.test(a.key))).length : 0;
  console.log(`${k.padEnd(8)} 대안 표기 줄 ${String(r.lines).padStart(3)} · 둘 이상 인식 ${String(r.parsed).padStart(3)} · 같은 등급 ${String(r.exact).padStart(3)} · 2단계 이상 차이(충돌) ${r.conflicts.length}${k.startsWith('gpu') ? ` (Intel 포함 ${intel} · NVIDIA·AMD끼리 ${r.conflicts.length - intel})` : ''}\n         → 제조사 사이 충돌 ${r.cross}건 중 새 규칙에서 판정에 닿는 줄 ${r.affected.length}건 (게임 ${new Set(r.affected.map((a) => a.game)).size}개)`);
}

const union = new Set([...result['gpu-min'].affected, ...result['gpu-rec'].affected, ...result['cpu-min'].affected, ...result['cpu-rec'].affected].map((a) => a.game));
const hitBy = {}; for (const r of Object.values(result)) for (const a of r.affected) for (const v of a.hit) hitBy[v] = (hitBy[v] || 0) + 1;
console.log('영향받는 사용자 제조사(줄 수 기준):', JSON.stringify(hitBy));
console.log(`\n판정에 실제로 닿는 충돌: 줄 ${Object.values(result).reduce((n, r) => n + r.affected.length, 0)}건, 서로 다른 게임 ${union.size}개 (이전 "가장 낮은 것" 규칙에서는 충돌 ${Object.values(result).reduce((n, r) => n + r.conflicts.length, 0)}줄 전부가 모든 사용자에게 영향)`);

if (MD) {
  const L = ['# PC 사양 등급표 대안 표기 충돌 목록', '', '게임 요구 사양의 "A 또는 B" 표기에서 같은 줄에 나온 부품끼리 등급 차이가 2단계 이상인 경우다. 제작사가 둘 중 하나면 된다고 적은 것이므로 등급표가 어긋났을 가능성이 있는 단서다. (등급표 수정은 검토 후)', ''];
  L.push('| 구분 | 대안 표기 줄 | 둘 이상 인식 | 같은 등급 | 충돌 | 제조사 사이 충돌 | 판정에 닿는 줄 |', '|---|---|---|---|---|---|---|');
  for (const [k, r] of Object.entries(result)) L.push(`| ${k.replace('gpu', 'GPU').replace('cpu', 'CPU').replace('-min', ' 최소').replace('-rec', ' 권장')} | ${r.lines} | ${r.parsed} | ${r.exact} | ${r.conflicts.length} | ${r.cross} | ${r.affected.length} |`);
  L.push('', '**판정에 닿는 줄**: 판정 규칙이 "제조사 일치 비교"로 바뀐 뒤에는 사용자가 요구 사양에서 자기 제조사 항목과 비교하므로, 충돌의 등급 차이는 줄에 없는 제조사의 사용자(주로 Intel 내장·Arc 사용자)에게만 닿는다. 그런 줄이 몇 개인지 센 값이다. CPU는 제조사가 Intel·AMD 둘뿐이라 어느 쪽 사용자든 자기 제조사 항목을 만나서 0건이다.');
  for (const [k, r] of Object.entries(result)) {
    if (!r.conflicts.length) continue;
    L.push('', `## ${k.replace('gpu', 'GPU').replace('cpu', 'CPU').replace('-min', ' 최소').replace('-rec', ' 권장')} — 충돌 ${r.conflicts.length}건`, '', '| 게임 | 원문 | 인식한 부품(등급) | 차이 |', '|---|---|---|---|');
    for (const c of r.conflicts.sort((a, b) => b.diff - a.diff)) L.push(`| ${c.game.replace(/\|/g, '/')} | ${c.text.replace(/\|/g, '/').slice(0, 90)} | ${c.alts.map((a) => `${a.key}(${a.tier})`).join(' vs ')} | ${c.diff} |`);
  }
  fs.writeFileSync(MD, L.join('\n') + '\n');
  console.log(`\n저장: ${MD}`);
}
