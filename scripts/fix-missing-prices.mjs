import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  const { data: games } = await supabase
    .from('games')
    .select('id, name, steam_appid, is_free');

  if (!games) return;

  for (const game of games) {
    if (game.is_free) {
      console.log(`건너뜀 (무료): ${game.name}`);
      continue;
    }

        const res = await fetch(
      `https://store.steampowered.com/api/appdetails?appids=${game.steam_appid}&cc=kr&l=korean`
    );
    const json = await res.json();
    if (!json || !json[game.steam_appid]) {
      console.log(`응답 없음: ${game.name}`);
      await new Promise((r) => setTimeout(r, 600));
      continue;
    }
    const data = json[game.steam_appid]?.data;

    if (!data || data.is_free || !data.price_overview) {
      console.log(`가격 없음: ${game.name}`);
      continue;
    }

    const price = data.price_overview.final / 100;
    const original = data.price_overview.initial / 100;
    const discount = data.price_overview.discount_percent;

    // 기존 기록 전부 삭제 후 원화로 새로 삽입
    await supabase.from('price_history').delete().eq('game_id', game.id);
    await supabase.from('price_history').insert({
  game_id: game.id,
  price: price,
  discount_percent: discount,
  currency: 'KRW', // ← 추가
});

    console.log(`✅ ${game.name}: ₩${price.toLocaleString()} (할인 ${discount}%, 정가 ₩${original.toLocaleString()})`);
    await new Promise((r) => setTimeout(r, 700));
  }
}

main();