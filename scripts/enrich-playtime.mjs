import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  const { data: games } = await supabase
    .from('games')
    .select('id, name, steam_appid')
    .is('average_playtime_forever', null);

  if (!games) return;

  for (const game of games) {
    try {
      const res = await fetch(`https://steamspy.com/api.php?request=appdetails&appid=${game.steam_appid}`);
      const json = await res.json();

      await supabase.from('games').update({
        average_playtime_forever: json.average_forever || null,
        average_playtime_2weeks: json.average_2weeks || null,
      }).eq('id', game.id);

      console.log(`✅ ${game.name}: 전체 ${json.average_forever}분 | 2주 ${json.average_2weeks}분`);
    } catch {
      console.log(`실패: ${game.name}`);
    }

    await new Promise((r) => setTimeout(r, 1000));
  }
}

main();