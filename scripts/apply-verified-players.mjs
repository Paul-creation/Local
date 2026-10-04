// scripts/apply-verified-players.mjs
// 직접 검증한 최대 인원 결정 파일(data/verification/*.json)을 DB에 반영 (AI 안 씀)
// - 결정 파일 형식: { "fix": [{ "name", "appid", "min", "max", "source", "evidence" }], ... }
//   선택: "flags": { has_online_coop, has_local_coop, has_pvp, solo_playable } (true/false), "drop_activities": ["협력 생존"]
// - 이름(+스팀 appid)으로 게임을 찾고, 값이 이미 같으면 건너뜀
// - 결정할 때 본 값(before)이 있으면 지금 DB 값이 그대로일 때만 바꿈 (다른 곳에서 고친 값은 덮어쓰지 않음)
// - 반영 결과는 data/verification/applied-log.txt 에 덧붙임
// 실행: node --env-file=.env.local scripts/apply-verified-players.mjs data/verification/party-max-decisions.json
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { refreshCategory } from './lib/category.mjs';

const FLAGS = ['has_online_coop', 'has_local_coop', 'has_pvp', 'solo_playable'];
const mark = (v) => (v == null ? '?' : v ? 'O' : 'X');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const LOG = 'data/verification/applied-log.txt';

async function main() {
  const file = process.argv[2];
  if (!file) return console.error('결정 파일 경로를 넣어주세요');
  const { fix = [] } = JSON.parse(fs.readFileSync(file, 'utf8'));
  const lines = [];
  for (const f of fix) {
    let q = supabase.from('games').select(`id, name, min_players, max_players, activities, ${FLAGS.join(', ')}`).eq('name', f.name);
    if (f.appid) q = q.eq('steam_appid', f.appid);
    const { data, error } = await q;
    if (error || data.length !== 1) { console.log(`❌ ${f.name}: ${error?.message || `일치하는 게임 ${data.length}개`}`); continue; }
    const g = data[0];
    const update = {};
    if (f.min != null && g.min_players !== f.min) update.min_players = f.min;
    if (f.max !== undefined && g.max_players !== f.max) update.max_players = f.max;
    for (const [k, v] of Object.entries(f.flags || {})) if (FLAGS.includes(k) && g[k] !== v) update[k] = v;
    const drop = (f.drop_activities || []).filter((a) => g.activities?.includes(a));
    if (drop.length) update.activities = g.activities.filter((a) => !drop.includes(a));
    if (!Object.keys(update).length) { console.log(`= ${f.name}: 이미 ${f.min}~${f.max}`); continue; }
    // 결정할 때 본 값과 지금 값이 다르면 다른 곳에서 고친 것이므로 건드리지 않음
    if (f.before && f.before !== `${g.min_players ?? '?'}~${g.max_players ?? '?'}`) {
      console.log(`⚠️ ${f.name}: 결정 때 ${f.before}였는데 지금 ${g.min_players ?? '?'}~${g.max_players ?? '?'} — 건너뜀`);
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
  console.log(`\n${lines.length}개 반영`);
}

main().catch((e) => { console.error(`❌ ${e.message}`); process.exit(1); });
