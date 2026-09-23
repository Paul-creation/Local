import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ITAD_KEY = process.env.ITAD_API_KEY;

async function getHeatRank(steamAppid) {
  try {
    const lookupRes = await fetch(
      `https://api.isthereanydeal.com/games/lookup/v1?key=${ITAD_KEY}&appid=${steamAppid}`
    );
    const lookup = await lookupRes.json();
    if (!lookup.found) return null;

    const id = lookup.game.id;
    const infoRes = await fetch(
      `https://api.isthereanydeal.com/games/info/v2?key=${ITAD_KEY}&id=${id}`
    );
    const info = await infoRes.json();
    return info?.stats?.rank ?? null;
  } catch {
    return null;
  }
}

async function main() {
  // Supabase에 heat_rank 컬럼 없으면 먼저 추가 필요
  const { data: games } = await supabase.from('games').select('id, name, steam_appid');
  if (!games) return;

  for (const game of games) {
    const rank = await getHeatRank(game.steam_appid);
    if (rank !== null) {
      await supabase.from('games').update({ heat_rank: rank }).eq('id', game.id);
      console.log(`${game.name}: Heat #${rank}`);
    } else {
      console.log(`데이터 없음: ${game.name}`);
    }
    await new Promise((r) => setTimeout(r, 800));
  }
}

main();