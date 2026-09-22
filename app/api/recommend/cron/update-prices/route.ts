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

  const { data: games } = await supabase.from('games').select('id, steam_appid');
  let updated = 0;

  for (const game of games || []) {
    const res = await fetch(`https://store.steampowered.com/api/appdetails?appids=${game.steam_appid}&cc=kr`);
    const json = await res.json();
    const data = json[game.steam_appid]?.data;
    if (!data || data.is_free || !data.price_overview) continue;

    await supabase.from('price_history').insert({
      game_id: game.id,
      price: data.price_overview.final / 100,
      discount_percent: data.price_overview.discount_percent,
    });
    updated++;
  }

  return NextResponse.json({ updated });
}