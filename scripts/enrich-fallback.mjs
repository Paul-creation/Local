import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function guessCategory(genres = [], name = '') {
  const safeGenres = genres || [];
  const all = [...safeGenres, name].join(' ').toLowerCase();
  if (all.includes('survival')) return '서바이벌';
  if (all.includes('puzzle')) return '퍼즐';
  if (all.includes('party')) return '파티';
  return '협동';
}

async function main() {
  const { data: games, error } = await supabase
    .from('games')
    .select('id, name, steam_appid, category, min_players, max_players, difficulty, genres');

  if (error) {
    console.error('조회 실패:', error.message);
    return;
  }

  for (const game of games) {
    // 이미 값이 있으면 절대 건드리지 않음
    const needsFill = !game.category || !game.min_players || !game.difficulty;
    if (!needsFill) {
      console.log(`건너뜀 (이미 채워짐): ${game.name}`);
      continue;
    }

        const res = await fetch(`https://store.steampowered.com/api/appdetails?appids=${game.steam_appid}`);
    const json = await res.json();
    if (!json || !json[game.steam_appid]?.success) {
      await new Promise((r) => setTimeout(r, 600));
      continue;
    }

    const data = json[game.steam_appid].data;
    const categories = (data.categories || []).map((c) => c.description);
    const hasCoop = categories.some((c) => /co-op/i.test(c));

    const update = {};
    if (!game.category) update.category = guessCategory(game.genres, game.name);
    if (!game.min_players) {
      update.min_players = hasCoop ? 2 : 1;
      update.max_players = hasCoop ? 4 : 1;
    }
    if (!game.difficulty) update.difficulty = '보통';

    const { error: updateError } = await supabase.from('games').update(update).eq('id', game.id);

    if (updateError) {
      console.error(`업데이트 실패 (${game.name}):`, updateError.message);
    } else {
      console.log(`추정값 채움: ${game.name} →`, update);
    }

    await new Promise((r) => setTimeout(r, 800));
  }
}

main();