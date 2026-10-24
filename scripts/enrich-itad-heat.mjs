// scripts/enrich-itad-heat.mjs
// ITAD에서 매일 갱신: 인기 순위(heat_rank)·역대 최고 동접(peak_players)·한국 역대 최저가(상점 포함)
// 현재 동접(current_players)은 enrich-players(스팀 실시간)만 씀 — 여기선 건드리지 않음
// 고정 값인 메타스코어는 빈 칸일 때만 채움. 한 번 찾은 ITAD ID는 games.itad_id에 저장해 lookup을 건너뜀
// 증분: 매일은 ITAD ID가 없는 게임 + heat_rank 상위 150개 + 게임 id 해시 % 7 == 요일(KST)인 게임만 (7일에 한 바퀴). ITAD에 없다고 확인된 게임은 30일간 lookup을 건너뜀
// 실행: node --env-file=.env.local scripts/enrich-itad-heat.mjs [--ids 파일.json] [--dry] [--all]
//   --dry: 저장하지 않고 저장할 값만 출력
//   --all: 요일과 상관없이 전체 (없음 캐시도 무시)
import { createClient } from '@supabase/supabase-js';
import { lookupItadId, getGameInfo, getHistoryLows, ItadLimitError } from './lib/itad.mjs';
import { processHeatBatches } from './lib/itad-heat-batch.mjs';
import { onlyIds } from './lib/only-ids.mjs';
import { kstWeekday } from './lib/backfill-targets.mjs';
import { isHeatTarget, hotIds, HOT_TOP_N, loadMissing, saveMissing } from './lib/heat-targets.mjs';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
const DRY = process.argv.includes('--dry');
const ALL = process.argv.includes('--all');
const LOW_BATCH = 100; // historylow 한 번에 보내는 게임 수

async function main() {
  if (!process.env.ITAD_API_KEY) return console.error('.env.local에 ITAD_API_KEY가 없어요');

  const { data: allGames, error } = await onlyIds(supabase
    .from('games')
    .select('id, name, steam_appid, itad_id, metascore, heat_rank')
    .eq('hidden', false)
    .eq('release_status', 'released')
    .not('steam_appid', 'is', null));
  if (error) return console.error(`❌ 게임 목록을 못 불러옴: ${error.message}`);

  const weekday = kstWeekday();
  const missing = loadMissing();
  let missingChanged = false;
  const hot = hotIds(allGames);
  const games = allGames.filter((g) => isHeatTarget(g, weekday, { all: ALL, missing, hot }));
  console.log(`스팀 게임 ${allGames.length}개 중 ${games.length}개 확인 시작 (${ALL ? '--all' : `새 게임 + heat 상위 ${HOT_TOP_N}개 + 요일 ${weekday} 몫`}, ITAD 미등록으로 건너뜀 ${allGames.filter((g) => !g.itad_id).length - games.filter((g) => !g.itad_id).length}개)\n`);

  const collect = async (game) => {
    let itadId = game.itad_id;
    if (!itadId) {
      itadId = await lookupItadId({ appid: game.steam_appid });
      if (!itadId) {
        if (!DRY) { missing[game.steam_appid] = new Date().toISOString(); missingChanged = true; }
        return null;
      }
      if (missing[game.steam_appid]) { delete missing[game.steam_appid]; missingChanged = true; }
    }
    const info = await getGameInfo(itadId);
    const update = {};
    if (!game.itad_id) update.itad_id = itadId;
    // 매일 바뀌는 값은 덮어쓴다 (ITAD가 값을 못 줬으면 기존 값 유지)
    if (info.rank !== null) update.heat_rank = info.rank;
    if (info.peakPlayers !== null) update.peak_players = info.peakPlayers;
    // 고정 값은 빈 칸만
    if (info.metascore !== null && game.metascore == null) update.metascore = info.metascore;
    return { update, itadId };
  };

  const save = async (game, update, low) => {
    if (DRY) {
      console.log(`[dry] ${game.name}: ${JSON.stringify(update)}`);
      return true;
    }
    const { error: upErr } = await supabase.from('games').update(update).eq('id', game.id);
    if (upErr) {
      console.log(`❌ 저장 실패 (${game.name}): ${upErr.message}`);
      return false;
    }
    console.log(`${game.name}: Heat #${update.heat_rank ?? '-'} | 피크 ${update.peak_players ?? '-'} | 최저가 ${low?.price ?? '-'}${low ? ` (${low.shop})` : ''}${update.metascore != null ? ` | 메타 ${update.metascore}` : ''}`);
    return true;
  };

  // 역대 최저가는 배치(LOW_BATCH개)마다 한 번에 조회하고, 배치가 끝나면 바로 저장
  const r = await processHeatBatches({ games, batchSize: LOW_BATCH, collect, getLows: getHistoryLows, save, isLimitError: (e) => e instanceof ItadLimitError });
  if (missingChanged) saveMissing(missing);
  console.log(`\n완료 — 저장 ${r.saved}개 · ITAD에 없음 ${r.noMatch}개 · 실패 ${r.failed}개 (최저가 ${r.lowsCount}개)`);
}

main();
