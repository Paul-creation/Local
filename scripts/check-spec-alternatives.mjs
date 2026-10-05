// scripts/check-spec-alternatives.mjs
// 등급표 검증: 게임 사양의 "A 또는 B" 대안 표기에서 같은 줄에 나온 부품끼리 등급 차이가 2단계 이상이면 충돌로 보고
// (제작사가 "A 또는 B"라고 적었다면 둘은 대략 같은 급이라는 뜻 — 등급표가 어긋났는지 알려 주는 단서)
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

const ALT = / or | 또는 |\//i; // "대안 표기가 있는 줄" 기준 (조사 문서의 232개와 같은 기준)
const result = {};
for (const kind of ['gpu', 'cpu']) for (const which of ['min', 'rec']) {
  const r = { lines: 0, parsed: 0, conflicts: [], exact: 0 };
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
    if (diff >= 2) r.conflicts.push({ game: g.name, text, alts, diff });
  }
  result[`${kind}-${which}`] = r;
}

for (const [k, r] of Object.entries(result)) {
  const intel = k.startsWith('gpu') ? r.conflicts.filter((c) => c.alts.some((a) => /^(arc|hd graphics|uhd|iris)/.test(a.key))).length : 0;
  console.log(`${k.padEnd(8)} 대안 표기 줄 ${String(r.lines).padStart(3)} · 둘 이상 인식 ${String(r.parsed).padStart(3)} · 같은 등급 ${String(r.exact).padStart(3)} · 2단계 이상 차이(충돌) ${r.conflicts.length}${k.startsWith('gpu') ? ` (Intel 포함 ${intel} · NVIDIA·AMD끼리 ${r.conflicts.length - intel})` : ''}`);
}

if (MD) {
  const L = ['# PC 사양 등급표 대안 표기 충돌 목록', '', '게임 요구 사양의 "A 또는 B" 표기에서 같은 줄에 나온 부품끼리 등급 차이가 2단계 이상인 경우다. 제작사가 둘 중 하나면 된다고 적은 것이므로 등급표가 어긋났을 가능성이 있는 단서다. (등급표 수정은 검토 후)', ''];
  L.push('| 구분 | 대안 표기 줄 | 둘 이상 인식 | 같은 등급 | 충돌 |', '|---|---|---|---|---|');
  for (const [k, r] of Object.entries(result)) L.push(`| ${k.replace('gpu', 'GPU').replace('cpu', 'CPU').replace('-min', ' 최소').replace('-rec', ' 권장')} | ${r.lines} | ${r.parsed} | ${r.exact} | ${r.conflicts.length} |`);
  for (const [k, r] of Object.entries(result)) {
    if (!r.conflicts.length) continue;
    L.push('', `## ${k.replace('gpu', 'GPU').replace('cpu', 'CPU').replace('-min', ' 최소').replace('-rec', ' 권장')} — 충돌 ${r.conflicts.length}건`, '', '| 게임 | 원문 | 인식한 부품(등급) | 차이 |', '|---|---|---|---|');
    for (const c of r.conflicts.sort((a, b) => b.diff - a.diff)) L.push(`| ${c.game.replace(/\|/g, '/')} | ${c.text.replace(/\|/g, '/').slice(0, 90)} | ${c.alts.map((a) => `${a.key}(${a.tier})`).join(' vs ')} | ${c.diff} |`);
  }
  fs.writeFileSync(MD, L.join('\n') + '\n');
  console.log(`\n저장: ${MD}`);
}
