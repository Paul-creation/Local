// scripts/fill-steam-categories.mjs
// 스팀 상점 공식 카테고리로 has_online_coop / has_local_coop / has_pvp 채우기 (무료, AI 안 씀)
// - Online Co-op 또는 LAN Co-op → has_online_coop
// - Shared/Split Screen Co-op(39) → has_local_coop
//   화면 공유(Shared/Split Screen, 24)만 있고 협동 카테고리(Co-op 9 / Shared/Split Screen Co-op 39)가 없으면 켜지 않음
//   (24는 한 화면 대전 게임에도 붙음)
// - Online PvP · LAN PvP · Shared/Split Screen PvP → has_pvp
// - 카테고리가 있는데 해당 항목이 없으면 false, 스팀이 카테고리를 안 주면 건드리지 않음
// - 'Multi-player'·'Cross-Platform Multiplayer'·'MMO'처럼 종류 없는 멀티만 있으면 건드리지 않고 목록으로 보여줌
//   (TF2·CS2처럼 협동/대전 세부 카테고리가 없는 멀티 게임이 세 칸 모두 false가 되는 것을 막음)
// - 이미 값이 있는 칸은 덮어쓰지 않고, 세 칸이 다 채워진 게임은 다시 요청하지 않음
// - solo_playable은 바꾸지 않고, 스팀 Single-player와 DB 값이 다른 게임만 목록으로 보여줌
// - 받은 카테고리는 scripts/.cache/steam-categories.json에 저장 (verify-players-web.mjs 프롬프트에 씀)
// 실행: node --env-file=.env.local scripts/fill-steam-categories.mjs   (579개 기준 약 20분, 요청 간격 2초)
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { steamGet, appdetailsUrl, SteamLimitError } from './lib/steam.mjs';
import { refreshCategory } from './lib/category.mjs';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const CACHE = 'scripts/.cache/steam-categories.json';
const FIELDS = ['has_online_coop', 'has_local_coop', 'has_pvp'];
const RULES = {
  has_online_coop: ['Online Co-op', 'LAN Co-op'],
  has_local_coop: ['Shared/Split Screen Co-op'], // 'Shared/Split Screen'은 일부러 넣지 않음
  has_pvp: ['Online PvP', 'LAN PvP', 'Shared/Split Screen PvP'],
};
const VAGUE = ['Multi-player', 'Cross-Platform Multiplayer', 'MMO'];

async function main() {
  const cache = fs.existsSync(CACHE) ? JSON.parse(fs.readFileSync(CACHE, 'utf8')) : {};
  const save = () => { fs.mkdirSync('scripts/.cache', { recursive: true }); fs.writeFileSync(CACHE, JSON.stringify(cache, null, 2)); };

  const { data, error } = await supabase
    .from('games')
    .select(`id, name, steam_appid, solo_playable, ${FIELDS.join(', ')}`).eq('hidden', false)
    .not('steam_appid', 'is', null)
    .order('id');
  if (error) throw new Error(`게임 목록을 못 불러옴: ${error.message}`);
  const todo = data.filter((g) => FIELDS.some((f) => g[f] == null));
  console.log(`스팀 게임 ${data.length}개 중 빈 칸이 있는 게임 ${todo.length}개 처리\n`);

  const count = { saved: 0, noCategory: 0, failed: 0 };
  const soloDiff = [];
  const vague = [];
  for (const [i, g] of todo.entries()) {
    let cats = cache[g.steam_appid]?.categories;
    if (!cats) {
      try {
        const json = await steamGet(appdetailsUrl(g.steam_appid, 'english'));
        const d = json?.[g.steam_appid];
        cats = d?.success ? (d.data.categories || []).map((c) => c.description) : null;
      } catch (e) {
        if (e instanceof SteamLimitError) { console.log(`⛔ ${e.message} — 여기서 멈춤 (다음 실행 때 이어서)`); break; }
        console.log(`❌ ${g.name}: ${e.message}`); count.failed++; continue;
      }
      if (cats) { cache[g.steam_appid] = { name: g.name, categories: cats }; save(); }
    }
    if (!cats?.length) { count.noCategory++; console.log(`⚪ ${g.name}: 스팀 카테고리 없음`); continue; }
    const known = Object.values(RULES).flat().some((c) => cats.includes(c));
    if (!known && cats.some((c) => VAGUE.includes(c))) { vague.push(g.name); console.log(`❔ ${g.name}: 멀티 종류 불명 — 직접 확인`); continue; }

    const update = {};
    for (const f of FIELDS) if (g[f] == null) update[f] = RULES[f].some((c) => cats.includes(c));
    // 처리하는 동안 다른 곳에서 채운 칸은 건드리지 않음
    let q = supabase.from('games').update(update).eq('id', g.id);
    for (const f of Object.keys(update)) q = q.is(f, null);
    const { error: e } = await q;
    if (e) { console.log(`❌ ${g.name}: ${e.message}`); count.failed++; continue; }
    count.saved++;
    await refreshCategory(supabase, g.id); // 협동/대전 칸이 바뀌면 배지도 다시 계산

    const steamSolo = cats.includes('Single-player');
    if (g.solo_playable != null && g.solo_playable !== steamSolo) soloDiff.push({ name: g.name, db: g.solo_playable, steamSolo });
    const on = Object.entries(update).filter(([, v]) => v).map(([k]) => k.replace('has_', ''));
    console.log(`✅ [${i + 1}/${todo.length}] ${g.name}: ${on.join(', ') || '(모두 없음)'}`);
  }

  console.log(`\n완료 — 저장 ${count.saved}개 · 카테고리 없음 ${count.noCategory}개 · 멀티 종류 불명 ${vague.length}개 · 실패 ${count.failed}개`);
  if (vague.length) console.log(`\n## 멀티 종류 불명 (협동·대전 칸을 직접 채워야 함)\n${vague.map((n) => `- ${n}`).join('\n')}`);
  const dbFalse = soloDiff.filter((d) => d.steamSolo);
  const dbTrue = soloDiff.filter((d) => !d.steamSolo);
  console.log(`\n## solo_playable이 스팀과 다른 게임 (바꾸지 않음)\n`);
  console.log(`### DB는 '혼자 불가'인데 스팀에 Single-player 있음 (${dbFalse.length}개)`);
  for (const d of dbFalse) console.log(`- ${d.name}`);
  console.log(`\n### DB는 '혼자 가능'인데 스팀에 Single-player 없음 (${dbTrue.length}개)`);
  for (const d of dbTrue) console.log(`- ${d.name}`);
}

main().catch((e) => { console.error(`❌ ${e.message}`); process.exit(1); });
