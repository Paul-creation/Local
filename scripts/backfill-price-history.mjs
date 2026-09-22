import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ITAD_KEY = process.env.ITAD_API_KEY;
const MAX_RECORDS_PER_GAME = 15; // 그래프가 너무 빽빽해지지 않게 최근 15개만

async function getItadId(steamAppid) {
  const res = await fetch(
    `https://api.isthereanydeal.com/games/lookup/v1?key=${ITAD_KEY}&appid=${steamAppid}`
  );
  const json = await res.json();
  return json.found ? json.game.id : null;
}

async function getPriceHistory(itadId) {
  const res = await fetch(
    `https://api.isthereanydeal.com/games/history/v2?key=${ITAD_KEY}&id=${itadId}&country=US`
  );
  return res.json();
}

async function main() {
  const { data: games, error } = await supabase
    .from('games')
    .select('id, name, steam_appid, price_history(id)');

  if (error) {
    console.error('조회 실패:', error.message);
    return;
  }

  for (const game of games) {
    // 이미 기록이 2개 이상이면(백필했거나 크론이 돌았으면) 건너뜀
    if ((game.price_history?.length || 0) > 1) {
      console.log(`건너뜀 (이미 기록 있음): ${game.name}`);
      continue;
    }

    const itadId = await getItadId(game.steam_appid);
    if (!itadId) {
      console.log(`건너뜀 (ITAD 매칭 실패): ${game.name}`);
      continue;
    }

    const history = await getPriceHistory(itadId);
    if (!Array.isArray(history) || history.length === 0) {
      console.log(`기록 없음: ${game.name}`);
      continue;
    }

    const steamOnly = history
      .filter((h) => h.shop?.name === 'Steam')
      .slice(0, MAX_RECORDS_PER_GAME);

    if (steamOnly.length === 0) {
      console.log(`Steam 기록 없음: ${game.name}`);
      continue;
    }

    const rows = steamOnly.map((h) => ({
      game_id: game.id,
      price: h.deal.price.amount,
      discount_percent: h.deal.cut,
      checked_at: h.timestamp,
    }));

    const { error: insertError } = await supabase.from('price_history').insert(rows);

    if (insertError) {
      console.error(`저장 실패 (${game.name}):`, insertError.message);
    } else {
      console.log(`${game.name}: Steam 기록 ${rows.length}개 저장`);
    }

    await new Promise((r) => setTimeout(r, 800));
  }
}

main();