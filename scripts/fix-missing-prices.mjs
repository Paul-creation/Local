import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  const { data: games, error } = await supabase
    .from('games')
    .select('id, name, steam_appid, is_free, price_history(id)');

  if (error) {
    console.error('조회 실패:', error.message);
    return;
  }

  for (const game of games) {
    const res = await fetch(`https://store.steampowered.com/api/appdetails?appids=${game.steam_appid}&cc=kr&l=korean`);
    const json = await res.json();
    if (!json[game.steam_appid]?.success) continue;

    const data = json[game.steam_appid].data;

    if (data.is_free) {
      if (!game.is_free) {
        await supabase.from('games').update({ is_free: true }).eq('id', game.id);
        console.log(`무료 게임으로 표시: ${game.name}`);
      }
    } else if ((game.price_history?.length || 0) === 0 && data.price_overview) {
      await supabase.from('price_history').insert({
        game_id: game.id,
        price: data.price_overview.final / 100,
        discount_percent: data.price_overview.discount_percent,
      });
      console.log(`가격 채움: ${game.name} → ${data.price_overview.final_formatted}`);
    }

    await new Promise((r) => setTimeout(r, 700));
  }
}

main();