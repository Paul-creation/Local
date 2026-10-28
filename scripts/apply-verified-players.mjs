// scripts/apply-verified-players.mjs
// 직접 검증한 최대 인원 결정 파일(data/verification/*.json)을 DB에 반영 (AI 안 씀)
// - 결정 파일 형식: { "fix": [{ "name", "appid", "min", "max", "source", "evidence" }], ... }
//   선택: "flags": { has_online_coop, has_local_coop, has_pvp, solo_playable } (true/false), "drop_activities": ["협력 생존"]
// - 이름(+스팀 appid)으로 게임을 찾고, 값이 이미 같으면 건너뜀
// - 결정할 때 본 값(before)이 있으면 지금 DB 값이 그대로일 때만 바꿈 (다른 곳에서 고친 값은 덮어쓰지 않음)
// - 반영 결과는 data/verification/applied-log.txt 에 덧붙임
// - 미리보기가 기본(DB 쓰기·로그 없음). --apply일 때만 DB에 씀
// - verify-players-web.mjs 결과(scripts/.cache/verify-players-v2.json)도 받음: confidence가 high·medium인 게임만, 비어 있는 min_players·max_players만 채움 (이미 있는 값은 안 덮어씀)
//   max_players는 결과의 online_max·local_max 중 큰 값. 플래그(협동·대전·혼자)는 건드리지 않음
//   --include <게임id>,<게임id>: confidence가 low여도 반영할 게임 (예외)
// 실행: node --env-file=.env.local scripts/apply-verified-players.mjs data/verification/party-max-decisions.json [--apply]
//       node --env-file=.env.local scripts/apply-verified-players.mjs scripts/.cache/verify-players-v2.json [--include id,id] [--apply]
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { refreshCategory } from './lib/category.mjs';

const FLAGS = ['has_online_coop', 'has_local_coop', 'has_pvp', 'solo_playable'];
const mark = (v) => (v == null ? '?' : v ? 'O' : 'X');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const LOG = 'data/verification/applied-log.txt';
const APPLY = process.argv.includes('--apply');
const inc = process.argv.indexOf('--include');
const INCLUDE = new Set(inc > 0 ? (process.argv[inc + 1] || '').split(',').filter(Boolean) : []);
const OK_CONFIDENCE = new Set(['high', 'medium']);

// verify-players-web.mjs 결과 → 결정 목록. 근거가 약한(low·없음) 게임은 --include로 지정한 것만
function fromVerifyCache(cache) {
  const fix = [], skipped = [];
  for (const [id, c] of Object.entries(cache)) {
    const r = c.result;
    if (!r) { skipped.push(`${c.name}: 결과 없음`); continue; }
    if (!OK_CONFIDENCE.has(r.confidence) && !INCLUDE.has(id)) { skipped.push(`${c.name}: confidence ${r.confidence ?? '없음'} — 제외 (--include로 예외 가능)`); continue; }
    if (r.max_players == null) { skipped.push(`${c.name}: 최대 인원 없음`); continue; }
    const src = r.sources?.online_max || r.sources?.local_max || '';
    fix.push({ id, name: c.name, min: r.min_players ?? undefined, max: r.max_players, onlyIfEmpty: true, source: src, evidence: `웹 확인 ${r.confidence ?? '?'}${INCLUDE.has(id) && !OK_CONFIDENCE.has(r.confidence) ? '·예외 포함' : ''} online ${r.online_max ?? '?'}/local ${r.local_max ?? '?'}` });
  }
  return { fix, skipped };
}

async function main() {
  const file = process.argv[2];
  if (!file) return console.error('결정 파일 경로를 넣어주세요');
  const json = JSON.parse(fs.readFileSync(file, 'utf8'));
  const v2 = !Array.isArray(json.fix) && Object.values(json).some((c) => c && 'checked_at' in c);
  const { fix, skipped } = v2 ? fromVerifyCache(json) : { fix: json.fix || [], skipped: [] };
  console.log(`${APPLY ? '반영' : '미리보기'} — ${fix.length}개${v2 ? ' (verify-players 결과)' : ''}`);
  for (const k of skipped) console.log(`- ${k}`);
  const lines = [];
  for (const f of fix) {
    let q = supabase.from('games').select(`id, name, min_players, max_players, activities, solo_mode, ${FLAGS.join(', ')}`).eq('name', f.name);
    if (f.id) q = q.eq('id', f.id);
    if (f.appid) q = q.eq('steam_appid', f.appid);
    const { data, error } = await q;
    if (error || data.length !== 1) { console.log(`❌ ${f.name}: ${error?.message || `일치하는 게임 ${data.length}개`}`); continue; }
    const g = data[0];
    const update = {};
    if (f.min != null && g.min_players !== f.min && !(f.onlyIfEmpty && g.min_players != null)) update.min_players = f.min;
    if (f.max !== undefined && g.max_players !== f.max && !(f.onlyIfEmpty && g.max_players != null)) update.max_players = f.max;
    for (const [k, v] of Object.entries(f.flags || {})) {
      if (k === 'solo_playable' && g.solo_mode) { console.log(`= ${f.name}: solo_mode(${g.solo_mode})가 있어 solo_playable은 건드리지 않음`); continue; }
      if (FLAGS.includes(k) && g[k] !== v) update[k] = v;
    }
    const drop = (f.drop_activities || []).filter((a) => g.activities?.includes(a));
    if (drop.length) update.activities = g.activities.filter((a) => !drop.includes(a));
    if (!Object.keys(update).length) { console.log(`= ${f.name}: 이미 ${f.min}~${f.max}`); continue; }
    // 결정할 때 본 값과 지금 값이 다르면 다른 곳에서 고친 것이므로 건드리지 않음
    if (f.before && f.before !== `${g.min_players ?? '?'}~${g.max_players ?? '?'}`) {
      console.log(`⚠️ ${f.name}: 결정 때 ${f.before}였는데 지금 ${g.min_players ?? '?'}~${g.max_players ?? '?'} — 건너뜀`);
      continue;
    }
    if (!APPLY) {
      console.log(`· ${f.name}: ${g.min_players ?? '?'}~${g.max_players ?? '?'} → ${update.min_players ?? g.min_players ?? '?'}~${update.max_players ?? g.max_players ?? '?'} (${f.evidence} / ${f.source})`);
      continue;
    }
    let u = supabase.from('games').update(update).eq('id', g.id);
    for (const k of Object.keys(update)) {
      if (k === 'activities') continue; // 배열 칸은 비교 조건에서 빼고 나머지 칸·id로 확인
      u = g[k] == null ? u.is(k, null) : u.eq(k, g[k]);
    }
    const { data: done, error: e } = await u.select('id');
    if (e || !done?.length) { console.log(`❌ ${f.name}: ${e?.message || '그사이 값이 바뀌어 건너뜀'}`); continue; }
    const badge = await refreshCategory(supabase, g.id); // 인원·협동/대전 칸이 바뀌었으니 배지도 다시 계산
    const extra = [
      ...Object.keys(update).filter((k) => FLAGS.includes(k)).map((k) => `${k} ${mark(g[k])}→${mark(update[k])}`),
      ...(drop.length ? [`활동 제거: ${drop.join(', ')}`] : []),
      ...(badge ? [`배지 ${badge.from ?? '없음'}→${badge.to ?? '없음'}`] : []),
    ];
    const max = f.max !== undefined ? f.max : g.max_players;
    const line = `${f.name}: ${g.min_players ?? '?'}~${g.max_players ?? '?'} → ${f.min ?? g.min_players ?? '?'}~${max ?? '?'}${extra.length ? ` [${extra.join(' · ')}]` : ''} (${f.evidence} / ${f.source})`;
    lines.push(`${new Date().toISOString().slice(0, 10)} ${line}`);
    console.log(`✅ ${line}`);
  }
  if (lines.length) fs.appendFileSync(LOG, lines.join('\n') + '\n');
  console.log(APPLY ? `\n${lines.length}개 반영` : '\n미리보기라 DB에 쓰지 않음 (--apply로 반영)');
}

main().catch((e) => { console.error(`❌ ${e.message}`); process.exit(1); });
