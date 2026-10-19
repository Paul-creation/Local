import { createClient } from '@supabase/supabase-js';
import { onlyIds } from './lib/only-ids.mjs';
import { getIgdbToken, igdbQuery, steamLookupBody, igdbValues, derivePlatform, isBlank, sameName } from './lib/igdb.mjs';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// 장르·테마·평점·개발사·배급사는 빈칸만 채운다(이미 값이 있으면 덮어쓰지 않음). 최대 인원은 여기서 DB에 쓰지 않는다 (후보값은 list-players-pending이 따로 읽어 "인원 검증 대기" 목록에만 담음)
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

async function main() {
  const token = await getIgdbToken();
  if (!token) {
    console.error('IGDB 토큰 발급 실패');
    return;
  }

  const { data: games } = await onlyIds(supabase
    .from('games')
    .select('id, name, steam_appid, platform, genres, themes, critic_score, developer, publisher').eq('hidden', false));

  if (!games) return;

  for (const game of games) {
    let igdbGame = game.steam_appid ? await fetchByAppid(game.steam_appid, token) : null;
    let matchedVia = 'appid';

    // 앱 ID로 못 찾으면 이름 검색 — 공백·기호·대소문자를 뺀 이름이 정확히 같을 때만 쓴다 (limit 1이 엉뚱한 게임을 잡아 장르·개발사를 덮어쓰던 문제)
    if (!igdbGame) {
      const byName = await fetchByName(game.name, token);
      if (byName && sameName(game.name, byName.name)) {
        igdbGame = byName;
        matchedVia = 'name';
      } else if (byName) {
        console.log(`이름 불일치로 건너뜀: ${game.name} ≠ IGDB "${byName.name}"`);
        await new Promise((r) => setTimeout(r, 300));
        continue;
      }
    }

    if (!igdbGame) {
      console.log(`매칭 실패: ${game.name}`);
      await new Promise((r) => setTimeout(r, 300));
      continue;
    }

    const found = igdbValues(igdbGame);
    const update = {};
    for (const [field, value] of Object.entries(found)) {
      if (isBlank(game[field]) && !isBlank(value)) update[field] = value;
    }

    // 플랫폼 — 기본값(steam만)일 때만 덮어씀
    const isDefaultPlatform = !game.platform || (game.platform.length === 1 && game.platform[0] === 'steam');
    if (isDefaultPlatform) {
      const platform = derivePlatform(game.platform, igdbGame.platforms, !!game.steam_appid);
      if (platform) update.platform = platform;
    }

    if (Object.keys(update).length === 0) {
      console.log(`채울 빈칸 없음 [${matchedVia}]: ${game.name}`);
      await new Promise((r) => setTimeout(r, 300));
      continue;
    }

    const { error } = await supabase.from('games').update(update).eq('id', game.id);

    if (error) {
      console.error(`업데이트 실패 (${game.name}):`, error.message);
    } else {
      console.log(`업데이트 성공 [${matchedVia}]: ${game.name} | 채운 칸: ${Object.keys(update).join(',')}`);
    }

    await new Promise((r) => setTimeout(r, 300));
  }
}

main();