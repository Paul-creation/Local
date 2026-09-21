import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function stripHtml(html) {
  if (!html) return null;
  return html
    .replace(/<br\s*\/?>/gi, ' / ')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function main() {
  const { data: games, error } = await supabase.from('games').select('id, name, steam_appid');
  if (error) {
    console.error('게임 목록 조회 실패:', error.message);
    return;
  }

  for (const game of games) {
    const res = await fetch(`https://store.steampowered.com/api/appdetails?appids=${game.steam_appid}&cc=kr&l=korean`);
    const json = await res.json();

    if (!json[game.steam_appid]?.success) {
      console.log(`실패: ${game.name}`);
      continue;
    }

    const data = json[game.steam_appid].data;
    const minSpec = stripHtml(data.pc_requirements?.minimum);

    const { error: updateError } = await supabase
      .from('games')
      .update({ min_spec: minSpec })
      .eq('id', game.id);

    if (updateError) {
      console.error(`업데이트 실패 (${game.name}):`, updateError.message);
    } else {
      console.log(`업데이트 성공: ${game.name}`);
    }

    await new Promise((r) => setTimeout(r, 1000));
  }
}

main();