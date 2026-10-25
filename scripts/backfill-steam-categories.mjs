// scripts/backfill-steam-categories.mjs
// games.steam_categories(스팀 카테고리 원문, 영어)가 빈 스팀 게임을 채움 — 플레이 방식 검사(lib/playstyle-guard.mjs)의 근거
// 실행: node --env-file=.env.local scripts/backfill-steam-categories.mjs                 (미리보기 — 대상 수만)
//       node --env-file=.env.local scripts/backfill-steam-categories.mjs --apply         (저장, 한 번에 최대 400개)
//       --max=N  한 번에 처리할 최대 개수 (기본 400, 요청 간격 2초)   --ids <파일>  지정한 게임만 (lib/only-ids.mjs)
// - scripts/.cache/steam-categories.json(fill-steam-categories가 남긴 캐시)을 먼저 쓰고, 없는 게임만 appdetails로 받음. AI 안 씀
// - steam_categories가 null인 게임만 대상, 이미 있는 값은 덮어쓰지 않음. 스팀이 카테고리를 안 주면 빈 배열({})로 기록해 다시 요청하지 않음
// - 칸이 없으면(마이그레이션 20261102090000_steam_categories.sql 전) 안내하고 끝냄
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { steamGet, appdetailsUrl, SteamLimitError } from './lib/steam.mjs';
import { onlyIds } from './lib/only-ids.mjs';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const APPLY = process.argv.includes('--apply');
const MAX = Number(process.argv.find((a) => a.startsWith('--max='))?.split('=')[1]) || 400;
const CACHE = 'scripts/.cache/steam-categories.json';

async function main() {
  let cache = {};
  try { cache = JSON.parse(fs.readFileSync(CACHE, 'utf8')); } catch { /* 캐시 없으면 전부 appdetails */ }

  const { data, error } = await onlyIds(supabase.from('games').select('id, name, steam_appid'))
    .eq('hidden', false).not('steam_appid', 'is', null).is('steam_categories', null).order('id').limit(MAX);
  if (error) return console.error(/steam_categories/.test(error.message)
    ? '❌ games.steam_categories 칸이 없어요 — supabase/migrations/20261102090000_steam_categories.sql 실행 필요'
    : `❌ 조회 실패: ${error.message}`);
  const fromCache = data.filter((g) => cache[g.steam_appid]?.categories).length;
  console.log(`${APPLY ? '저장' : '미리보기'} — 대상 ${data.length}개 (캐시 ${fromCache}개 · appdetails ${data.length - fromCache}개)`);
  if (!APPLY) return;

  const count = { saved: 0, empty: 0, failed: 0 };
  for (const [i, g] of data.entries()) {
    let cats = cache[g.steam_appid]?.categories;
    if (!cats) {
      try {
        const d = (await steamGet(appdetailsUrl(g.steam_appid, 'english')))?.[g.steam_appid];
        if (!d?.success) { console.log(`⚪ ${g.name}: 스팀 정보 없음 — 건너뜀`); count.failed++; continue; }
        cats = (d.data.categories || []).map((c) => c.description);
      } catch (e) {
        if (e instanceof SteamLimitError) { console.log(`⛔ ${e.message} — 여기서 멈춤 (다음 실행 때 이어서)`); break; }
        console.log(`❌ ${g.name}: ${e.message}`); count.failed++; continue;
      }
    }
    const { error: upErr } = await supabase.from('games').update({ steam_categories: cats }).eq('id', g.id).is('steam_categories', null);
    if (upErr) { console.log(`❌ ${g.name}: ${upErr.message}`); count.failed++; continue; }
    cats.length ? count.saved++ : count.empty++;
    if ((i + 1) % 50 === 0) console.log(`  … ${i + 1}/${data.length}`);
  }
  console.log(`\n완료 — 저장 ${count.saved}개 · 카테고리 없음(빈 배열) ${count.empty}개 · 실패·건너뜀 ${count.failed}개`);
}

main().catch((e) => { console.error(`❌ ${e.message}`); process.exit(1); });
