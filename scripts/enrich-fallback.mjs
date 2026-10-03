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
    .select('id, name, steam_appid, category, min_players, max_players, difficulty, genres').not('steam_appid', 'is', null);

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

    const res = await fetch(`https://store.steampowered.com/api/appdetails?appids=${game.steam_appid}&l=english`);
    const json = await res.json();
    if (!json || !json[game.steam_appid]?.success) {
      await new Promise((r) => setTimeout(r, 600));
      continue;
    }

    const data = json[game.steam_appid].data;
    const categories = (data.categories || []).map((c) => c.description);
    // 멀티·협동·대전 카테고리가 하나도 없고 싱글만 있을 때만 1인으로 확정. 그 밖에는 인원을 모르므로 null (1로 넣으면 1인용으로 보임)
    const isMulti = categories.some((c) => /multi|co-op|pvp|split screen|mmo/i.test(c));
    const isSingleOnly = categories.includes('Single-player') && !isMulti;

    const update = {};
    if (!game.category) update.category = guessCategory(game.genres, game.name);
    if (!game.min_players && isSingleOnly) {
      update.min_players = 1;
      update.max_players = 1;
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