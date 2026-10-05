// scripts/parse-specs.mjs
// 게임 PC 사양 텍스트(min_spec·recommended_spec)를 CPU·GPU 등급(대안 표기는 제조사별로 보존)·RAM·저장 공간으로 풀어 games.spec_parsed에 저장
// 실행: node --env-file=.env.local scripts/parse-specs.mjs                  (미리보기 — DB에 쓰지 않고 성공률만 출력)
//       node --env-file=.env.local scripts/parse-specs.mjs --out 파일.json    (미리보기 + 게임별 결과를 파일로)
//       node --env-file=.env.local scripts/parse-specs.mjs --apply          (spec_parsed·spec_hash 저장 — 마이그레이션 적용 후에만)
// - 등급표: data/pc-spec/gpu-tiers.json · cpu-tiers.json, 파서: app/lib/specParse.ts (설계: docs/pc-spec-checker-plan.md)
// - 저장 대상: 숨기지 않은 게임 중 spec_hash가 비었거나 사양 텍스트가 바뀐 것만. 이미 처리한 항목은 다시 처리하지 않음 (AI 안 씀)
// - 기존 min_spec·recommended_spec·storage_gb는 건드리지 않음
import fs from 'node:fs';
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { onlyIds } from './lib/only-ids.mjs';
import { parseSpecText } from '../app/lib/specParse.ts';

const APPLY = process.argv.includes('--apply');
const OUT = process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1] : null;
const VERSION = 2; // 2: cpu·gpu가 제조사별 등급({ nvidia, amd, intel, any })

export const loadTables = () => ({
  gpu: JSON.parse(fs.readFileSync('data/pc-spec/gpu-tiers.json', 'utf8')),
  cpu: JSON.parse(fs.readFileSync('data/pc-spec/cpu-tiers.json', 'utf8')),
});
export const specHash = (min, rec) => crypto.createHash('sha1').update(`${min || ''}\n${rec || ''}`).digest('hex').slice(0, 16);

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const tables = loadTables();

async function loadGames() {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await onlyIds(supabase.from('games').select('id, name, min_spec, recommended_spec').eq('hidden', false).range(from, from + 999));
    if (error) throw new Error(`게임 목록을 못 불러옴: ${error.message}`);
    rows.push(...data);
    if (data.length < 1000) break;
  }
  return rows;
}

const pct = (a, b) => (b ? `${((100 * a) / b).toFixed(0)}%` : '-');

function report(parsed) {
  for (const kind of ['min', 'rec']) {
    const list = parsed.map((p) => p[kind]).filter(Boolean);
    const n = list.length;
    const cnt = (f) => list.filter(f).length;
    const row = (label, ok, okStrict) => console.log(`  ${label.padEnd(8)} 포함(low_spec 포함) ${String(ok).padStart(4)}/${n} (${pct(ok, n)})   제외 ${String(okStrict).padStart(4)}/${n} (${pct(okStrict, n)})`);
    console.log(`\n[${kind === 'min' ? '최소' : '권장'} 사양] ${n}개`);
    row('GPU', cnt((s) => s.gpu != null), cnt((s) => s.gpu != null && s.detail.gpu.kind !== 'low-spec'));
    row('CPU', cnt((s) => s.cpu != null), cnt((s) => s.cpu != null && s.detail.cpu.kind !== 'low-spec'));
    row('RAM', cnt((s) => s.ram_gb != null), cnt((s) => s.ram_gb != null && s.detail.ram === 'ok'));
    row('저장공간', cnt((s) => s.storage_gb != null), cnt((s) => s.storage_gb != null));
    row('CPU+GPU+RAM', cnt((s) => s.gpu != null && s.cpu != null && s.ram_gb != null),
      cnt((s) => s.gpu != null && s.cpu != null && s.ram_gb != null && !s.low_spec && s.detail.cpu.kind !== 'class-only' && s.detail.ram === 'ok'));
    console.log(`  confidence: high ${cnt((s) => s.confidence === 'high')} · medium ${cnt((s) => s.confidence === 'medium')} · low ${cnt((s) => s.confidence === 'low')} / low_spec ${cnt((s) => s.low_spec)}개`);
  }
}

async function main() {
  const games = await loadGames();
  const parsed = games.map((g) => ({
    id: g.id, name: g.name, hash: specHash(g.min_spec, g.recommended_spec),
    min: parseSpecText(g.min_spec, tables), rec: parseSpecText(g.recommended_spec, tables),
  }));
  console.log(`대상 게임 ${games.length}개 (숨김 제외) — 최소 사양 ${parsed.filter((p) => p.min).length}개, 권장 사양 ${parsed.filter((p) => p.rec).length}개`);
  report(parsed);
  if (OUT) { fs.writeFileSync(OUT, JSON.stringify(parsed)); console.log(`\n결과 저장: ${OUT}`); }

  if (!APPLY) { console.log('\n미리보기라서 DB에는 아무것도 쓰지 않았어요 (저장은 --apply, 마이그레이션 적용 후).'); return; }

  // 마이그레이션이 적용됐는지 확인 (spec_hash 칸)
  const probe = await supabase.from('games').select('id, spec_hash').limit(1);
  if (probe.error) return console.error(`❌ spec_parsed·spec_hash 칸이 없어요 (마이그레이션 먼저): ${probe.error.message}`);
  const have = new Map();
  for (let from = 0; ; from += 1000) {
    const { data } = await supabase.from('games').select('id, spec_hash').range(from, from + 999);
    data.forEach((r) => have.set(r.id, r.spec_hash));
    if (data.length < 1000) break;
  }
  let done = 0, skipped = 0;
  for (const p of parsed) {
    if (!p.min && !p.rec) { skipped++; continue; }
    if (have.get(p.id) === p.hash) { skipped++; continue; } // 이미 처리한 항목
    const { error } = await supabase.from('games').update({ spec_parsed: { v: VERSION, min: p.min, rec: p.rec }, spec_hash: p.hash }).eq('id', p.id);
    if (error) console.log(`❌ ${p.name}: ${error.message}`); else done++;
  }
  console.log(`\n✅ 저장 ${done}개 · 건너뜀 ${skipped}개`);
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch((e) => { console.error(e); process.exit(1); });
