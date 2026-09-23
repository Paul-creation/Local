import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: games } = await supabase.from('games').select('id, name, steam_appid');
  let updated = 0;

  for (const game of games || []) {
    // 가격 갱신
    const priceRes = await fetch(
      `https://store.steampowered.com/api/appdetails?appids=${game.steam_appid}&cc=kr`
    );
    const priceJson = await priceRes.json();
    const data = priceJson[game.steam_appid]?.data;

    if (data && !data.is_free && data.price_overview) {
      await supabase.from('price_history').insert({
        game_id: game.id,
        price: data.price_overview.final / 100,
        discount_percent: data.price_overview.discount_percent,
      });
    }

    // 현재 접속자 수 기록
    const playerRes = await fetch(
      `https://api.steampowered.com/ISteamUserStats/GetNumberOfCurrentPlayers/v1/?appid=${game.steam_appid}`
    );
    const playerJson = await playerRes.json();
    const playerCount = playerJson.response?.player_count;

    if (playerCount) {
      await supabase.from('games').update({ current_players: playerCount }).eq('id', game.id);
      await supabase.from('player_history').insert({
        game_id: game.id,
        player_count: playerCount,
      });
    }

    updated++;
    await new Promise((r) => setTimeout(r, 500));
  }

  return NextResponse.json({ updated });
}