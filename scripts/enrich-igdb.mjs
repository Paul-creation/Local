import { createClient } from '@supabase/supabase-js';
import { onlyIds } from './lib/only-ids.mjs';
import { getIgdbToken, igdbQuery, steamLookupBody } from './lib/igdb.mjs';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const PLATFORM_MAP = {
  'pc (microsoft windows)': 'steam', 'mac': 'steam', 'linux': 'steam',
  'playstation 4': 'ps4', 'playstation 5': 'ps5',
  'xbox one': 'xbox', 'xbox series x|s': 'xbox',
  'nintendo switch': 'switch',
};

// 장르·개발사 등만 가져온다. 최대 인원은 여기서 DB에 쓰지 않는다 (후보값은 list-players-pending이 따로 읽어 "인원 검증 대기" 목록에만 담음)
const GAME_FIELDS = `game.name, game.genres.name, game.themes.name, game.aggregated_rating,
  game.platforms.name, game.involved_companies.company.name,
  game.involved_companies.developer, game.involved_companies.publisher`;

async function fetchByAppid(appid, token) {
  const data = await igdbQuery('external_games', steamLookupBody(appid, GAME_FIELDS), token);
  return data[0]?.game || null;
}

async function fetchByName(name, token) {
  const data = await igdbQuery(
    'games',
    `fields name, genres.name, themes.name, aggregated_rating, platforms.name,
     involved_companies.company.name, involved_companies.developer, involved_companies.publisher;
     search "${name}"; limit 1;`,
    token
  );
  return data[0] || null;
}

function mapPlatforms(igdbPlatforms = []) {
  const codes = new Set();
  igdbPlatforms.forEach((p) => {
    const code = PLATFORM_MAP[p.name?.toLowerCase()];
    if (code) codes.add(code);
  });
  return Array.from(codes);
}

async function main() {
  const token = await getIgdbToken();
  if (!token) {
    console.error('IGDB 토큰 발급 실패');
    return;
  }

  const { data: games } = await onlyIds(supabase
    .from('games')
    .select('id, name, steam_appid, platform').eq('hidden', false));

  if (!games) return;

  for (const game of games) {
    let igdbGame = await fetchByAppid(game.steam_appid, token);
    let matchedVia = 'appid';

    if (!igdbGame) {
      igdbGame = await fetchByName(game.name, token);
      matchedVia = 'name';
    }

    if (!igdbGame) {
      console.log(`매칭 실패: ${game.name}`);
      await new Promise((r) => setTimeout(r, 300));
      continue;
    }

    const genres = igdbGame.genres?.map((g) => g.name) || [];
    const themes = igdbGame.themes?.map((t) => t.name) || [];
    const developer = igdbGame.involved_companies?.find((c) => c.developer)?.company?.name || null;
    const publisher = igdbGame.involved_companies?.find((c) => c.publisher)?.company?.name || null;
    const criticScore = igdbGame.aggregated_rating ? Math.round(igdbGame.aggregated_rating) : null;

    const update = { genres, themes, critic_score: criticScore, developer, publisher };

    // 플랫폼 — 기본값(steam만)일 때만 덮어씀
    const isDefaultPlatform = !game.platform || (game.platform.length === 1 && game.platform[0] === 'steam');
    if (isDefaultPlatform) {
      const detected = mapPlatforms(igdbGame.platforms);
      if (detected.length > 0) {
        const stores = (game.platform || []).filter((c) => ['epic', 'battlenet', 'riot'].includes(c));
        const mapped = game.steam_appid ? detected : detected.filter((c) => c !== 'steam');
        update.platform = Array.from(new Set([...stores, ...mapped]));
      }
    }

    const { error } = await supabase.from('games').update(update).eq('id', game.id);

    if (error) {
      console.error(`업데이트 실패 (${game.name}):`, error.message);
    } else {
      console.log(`업데이트 성공 [${matchedVia}]: ${game.name} | 플랫폼: ${update.platform?.join(',') || '(유지)'}`);
    }

    await new Promise((r) => setTimeout(r, 300));
  }
}

main();