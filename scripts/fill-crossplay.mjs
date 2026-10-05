// scripts/fill-crossplay.mjs
// 스팀 카테고리 "Cross-Platform Multiplayer"(id 27)로 games.has_crossplay 채우기 (무료, AI 안 씀)
// 실행: node --env-file=.env.local scripts/fill-crossplay.mjs           (미리보기 — DB는 안 바꿈)
//       node --env-file=.env.local scripts/fill-crossplay.mjs --apply   (반영)
// - 먼저 supabase/migrations/20261014090000_launch_extras.sql 실행 필요
// - scripts/.cache/steam-categories.json(fill-steam-categories.mjs가 저장)에 카테고리가 있으면 그걸 쓰고, 없으면 스팀에 요청
//   (요청 간격·429 재시도는 scripts/lib/steam.mjs. 새로 받은 카테고리는 같은 캐시에 더해 저장)
// - 카테고리가 있으면 27번 유무로 true/false, 스팀이 카테고리를 안 주면 건드리지 않음
// - 이미 값이 있는 게임은 다시 처리하지 않고 덮어쓰지 않음. 스팀 외 게임(steam_appid 없음)은 null 그대로
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { steamGet, appdetailsUrl, SteamLimitError } from './lib/steam.mjs';

const APPLY = process.argv.includes('--apply');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const CACHE = 'scripts/.cache/steam-categories.json';
const CROSSPLAY = 'Cross-Platform Multiplayer'; // 스팀 카테고리 id 27 (캐시는 영어 이름으로 저장돼 있음)

async function main() {
  const cache = fs.existsSync(CACHE) ? JSON.parse(fs.readFileSync(CACHE, 'utf8')) : {};
  const save = () => { fs.mkdirSync('scripts/.cache', { recursive: true }); fs.writeFileSync(CACHE, JSON.stringify(cache, null, 2)); };

  const { data, error } = await supabase
    .from('games').select('id, name, steam_appid, has_crossplay').eq('hidden', false)
    .not('steam_appid', 'is', null).is('has_crossplay', null).order('id');
  if (error) throw new Error(`게임 목록을 못 불러옴: ${error.message}\n→ supabase/migrations/20261014090000_launch_extras.sql 을 먼저 실행하세요`);
  console.log(`${APPLY ? '[반영]' : '[미리보기]'} 크로스플레이 칸이 빈 스팀 게임 ${data.length}개\n`);

  const count = { yes: 0, no: 0, unknown: 0, failed: 0, fromCache: 0 };
  const yes = [];
  for (const [i, g] of data.entries()) {
    let cats = cache[g.steam_appid]?.categories;
    if (cats) count.fromCache++;
    else {
      try {
        const d = (await steamGet(appdetailsUrl(g.steam_appid, 'english')))?.[g.steam_appid];
        cats = d?.success ? (d.data.categories || []).map((c) => c.description) : null;
      } catch (e) {
        if (e instanceof SteamLimitError) { console.log(`스팀 요청 한도: ${e.message} — 여기서 멈춤 (다음 실행 때 이어서)`); break; }
        console.log(`실패 ${g.name}: ${e.message}`); count.failed++; continue;
      }
      if (cats) { cache[g.steam_appid] = { name: g.name, categories: cats }; save(); }
    }
    if (!cats?.length) { count.unknown++; continue; }
    const value = cats.includes(CROSSPLAY);
    if (APPLY) {
      // 처리하는 동안 다른 곳에서 채웠으면 덮어쓰지 않음
      const { error: e } = await supabase.from('games').update({ has_crossplay: value }).eq('id', g.id).is('has_crossplay', null);
      if (e) { console.log(`실패 ${g.name}: ${e.message}`); count.failed++; continue; }
    }
    if (value) count.yes++; else count.no++;
    if (value) yes.push(g.name);
    if ((i + 1) % 50 === 0) console.log(`  ${i + 1}/${data.length} 처리`);
  }

  console.log(`\n${APPLY ? '반영' : '반영 예정'} — 지원 ${count.yes}개 · 미지원 ${count.no}개 · 카테고리 없음(그대로 둠) ${count.unknown}개 · 실패 ${count.failed}개 (캐시 사용 ${count.fromCache}개)`);
  if (yes.length) console.log(`\n크로스플레이 지원:\n${yes.map((n) => `- ${n}`).join('\n')}`);
  if (!APPLY) console.log('\n미리보기만 했어요. 반영하려면 --apply를 붙여 주세요');
}

main().catch((e) => { console.error(e.message); process.exit(1); });
