// scripts/enrich-itad-heat.mjs
// ITAD에서 매일 갱신: 인기 순위(heat_rank)·역대 최고 동접(peak_players)·한국 역대 최저가(상점 포함)
// 현재 동접(current_players)은 enrich-players(스팀 실시간)만 씀 — 여기선 건드리지 않음
// 고정 값인 메타스코어는 빈 칸일 때만 채움. 한 번 찾은 ITAD ID는 games.itad_id에 저장해 lookup을 건너뜀
// 실행: node --env-file=.env.local scripts/enrich-itad-heat.mjs [--ids 파일.json] [--dry]
//   --dry: 저장하지 않고 저장할 값만 출력
import { createClient } from '@supabase/supabase-js';
import { lookupItadId, getGameInfo, getHistoryLows, ItadLimitError } from './lib/itad.mjs';
import { onlyIds } from './lib/only-ids.mjs';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
const DRY = process.argv.includes('--dry');
const LOW_BATCH = 100; // historylow 한 번에 보내는 게임 수

async function main() {
  if (!process.env.ITAD_API_KEY) return console.error('.env.local에 ITAD_API_KEY가 없어요');

  const { data: games, error } = await onlyIds(supabase
    .from('games')
    .select('id, name, steam_appid, itad_id, metascore')
    .eq('hidden', false)
    .not('steam_appid', 'is', null));
  if (error) return console.error(`❌ 게임 목록을 못 불러옴: ${error.message}`);

  const updates = new Map(); // game.id → 저장할 값
  const itadIdOf = new Map(); // game.id → ITAD ID
  let noMatch = 0;
  let failed = 0;

  for (const game of games) {
    try {
      let itadId = game.itad_id;
      if (!itadId) {
        itadId = await lookupItadId({ appid: game.steam_appid });
        if (!itadId) {
          console.log(`데이터 없음: ${game.name}`);
          noMatch++;
          continue;
        }
      }
      const info = await getGameInfo(itadId);
      const update = {};
      if (!game.itad_id) update.itad_id = itadId;
      // 매일 바뀌는 값은 덮어쓴다 (ITAD가 값을 못 줬으면 기존 값 유지)
      if (info.rank !== null) update.heat_rank = info.rank;
      if (info.peakPlayers !== null) update.peak_players = info.peakPlayers;
      // 고정 값은 빈 칸만
      if (info.metascore !== null && game.metascore == null) update.metascore = info.metascore;
      updates.set(game.id, update);
      itadIdOf.set(game.id, itadId);
    } catch (e) {
      if (e instanceof ItadLimitError) {
        console.log(`⏳ ITAD 요청 제한 — 여기서 멈춤: ${e.message}`);
        break;
      }
      console.log(`❌ 실패: ${game.name} — ${e.message}`);
      failed++;
    }
  }

  // 역대 최저가: 여러 게임을 한 번에 (LOW_BATCH개씩)
  const ids = [...itadIdOf.values()];
  const lows = new Map();
  for (let i = 0; i < ids.length; i += LOW_BATCH) {
    try {
      for (const [k, v] of await getHistoryLows(ids.slice(i, i + LOW_BATCH))) lows.set(k, v);
    } catch (e) {
      console.log(`❌ 역대 최저가 조회 실패 (${i + 1}~${i + LOW_BATCH}번째): ${e.message}`);
      failed++;
    }
  }

  let saved = 0;
  for (const game of games) {
    const update = updates.get(game.id);
    if (!update) continue;
    const low = lows.get(itadIdOf.get(game.id));
    if (low) Object.assign(update, { lowest_price: low.price, lowest_price_date: low.date, lowest_price_shop: low.shop });
    if (Object.keys(update).length === 0) continue;

    if (DRY) {
      console.log(`[dry] ${game.name}: ${JSON.stringify(update)}`);
      saved++;
      continue;
    }
    const { error: upErr } = await supabase.from('games').update(update).eq('id', game.id);
    if (upErr) {
      console.log(`❌ 저장 실패 (${game.name}): ${upErr.message}`);
      failed++;
    } else {
      saved++;
      console.log(`${game.name}: Heat #${update.heat_rank ?? '-'} | 피크 ${update.peak_players ?? '-'} | 최저가 ${low?.price ?? '-'}${low ? ` (${low.shop})` : ''}${update.metascore != null ? ` | 메타 ${update.metascore}` : ''}`);
    }
  }

  console.log(`\n완료 — 저장 ${saved}개 · ITAD에 없음 ${noMatch}개 · 실패 ${failed}개 (최저가 ${lows.size}개)`);
}

main();
