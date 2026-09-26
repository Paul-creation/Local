import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function getLastUpdateDate(appid) {
  try {
    const res = await fetch(
      `https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=${appid}&count=1&maxlength=1&format=json`
    );
    const json = await res.json();
    const item = json.appnews?.newsitems?.[0];
    if (!item) return null;
    const d = new Date(item.date * 1000);
    return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  } catch { return null; }
}

async function main() {
  const { data: games } = await supabase.from('games').select('id, name, steam_appid').not('steam_appid', 'is', null);
  if (!games) return;

  for (const game of games) {
    const lastUpdated = await getLastUpdateDate(game.steam_appid);

    if (!lastUpdated) {
      console.log(`업데이트 정보 없음: ${game.name}`);
      continue;
    }

    const { error } = await supabase
      .from('games')
      .update({ last_updated: lastUpdated })
      .eq('id', game.id);

    if (error) {
      console.error(`실패 (${game.name}):`, error.message);
    } else {
      console.log(`✅ ${game.name}: 마지막 업데이트 ${lastUpdated}`);
    }

    await new Promise((r) => setTimeout(r, 500));
  }
}

main();