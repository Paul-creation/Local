// scripts/enrich-screenshots.mjs
// 스팀 appdetails의 screenshots → games.screenshots [{ path_thumbnail, path_full }] 최대 10개
// 빈 칸(null)만 채우고, 한 번 처리한 게임은 다시 요청하지 않음 (스팀에 스크린샷이 없으면 빈 배열 [] 저장)
// 실행: node --env-file=.env.local scripts/enrich-screenshots.mjs [--max=개수] [--ids 파일.json] [--dry]
//   요청 간격 2초(lib/steam.mjs). 836개면 약 30분
import { createClient } from '@supabase/supabase-js';
import { onlyIds } from './lib/only-ids.mjs';
import { steamGet, appdetailsUrl, SteamLimitError } from './lib/steam.mjs';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
const DRY = process.argv.includes('--dry');
const MAX = Number((process.argv.find((a) => a.startsWith('--max=')) || '').slice(6)) || Infinity;
const PER_GAME = 10;

async function main() {
  const { data, error } = await onlyIds(supabase
    .from('games')
    .select('id, name, steam_appid')
    .eq('hidden', false)
    .not('steam_appid', 'is', null)
    .is('screenshots', null));
  if (error) return console.error(`❌ 게임 목록을 못 불러옴: ${error.message}`);
  const games = data.slice(0, MAX);
  console.log(`스크린샷이 빈 스팀 게임 ${data.length}개 중 ${games.length}개 처리 (약 ${Math.ceil(games.length * 2 / 60)}분)\n`);

  let ok = 0;
  let noInfo = 0;
  let failed = 0;

  for (const game of games) {
    let json;
    try {
      json = await steamGet(appdetailsUrl(game.steam_appid));
    } catch (e) {
      console.log(`${e instanceof SteamLimitError ? '⏳ 요청 제한' : '❌ 실패'}: ${game.name} — ${e.message}`);
      failed++;
      if (e instanceof SteamLimitError) break; // 막힌 상태로 계속 두드리지 않음 (다음 실행에서 이어서)
      continue;
    }
    const entry = json?.[game.steam_appid];
    if (!entry?.success) {
      // 판매 중단·지역 제한 — 칸은 비워 두고 다음 실행에서 다시 시도
      console.log(`➖ 스팀에 정보 없음: ${game.name} (${game.steam_appid})`);
      noInfo++;
      continue;
    }
    const screenshots = (entry.data.screenshots || [])
      .slice(0, PER_GAME)
      .map((s) => ({ path_thumbnail: s.path_thumbnail, path_full: s.path_full }));

    if (DRY) {
      console.log(`[dry] ${game.name}: ${screenshots.length}개 ${JSON.stringify(screenshots[0] ?? null)}`);
      ok++;
      continue;
    }
    // 그 사이 다른 곳에서 채웠으면 덮어쓰지 않음
    const { error: upErr } = await supabase.from('games').update({ screenshots }).eq('id', game.id).is('screenshots', null);
    if (upErr) {
      console.log(`❌ 저장 실패 (${game.name}): ${upErr.message}`);
      failed++;
    } else {
      ok++;
      console.log(`✅ ${game.name}: ${screenshots.length}개`);
    }
  }

  console.log(`\n완료 — 저장 ${ok}개 · 스팀에 정보 없음 ${noInfo}개 · 실패 ${failed}개`);
}

main();
