import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const PLATFORM_MAP = {
  'pc (microsoft windows)': 'steam',
  'mac': 'steam',
  'linux': 'steam',
  'playstation 4': 'ps4',
  'playstation 5': 'ps5',
  'xbox one': 'xbox',
  'xbox series x|s': 'xbox',
  'nintendo switch': 'switch',
};

async function getIgdbToken() {
  const res = await fetch(
    `https://id.twitch.tv/oauth2/token?client_id=${process.env.IGDB_CLIENT_ID}&client_secret=${process.env.IGDB_CLIENT_SECRET}&grant_type=client_credentials`,
    { method: 'POST' }
  );
  const data = await res.json();
  return data.access_token;
}

async function fetchIgdbData(name, token) {
  const query = `
    fields name, genres.name, themes.name, aggregated_rating, platforms.name,
           involved_companies.company.name, involved_companies.developer, involved_companies.publisher;
    search "${name}";
    limit 1;
  `;

  const res = await fetch('https://api.igdb.com/v4/games', {
    method: 'POST',
    headers: {
      'Client-ID': process.env.IGDB_CLIENT_ID,
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
    body: query,
  });

  const data = await res.json();
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
    console.error('IGDB 토큰 발급 실패 — Client ID/Secret 확인해줘');
    return;
  }

  const { data: games, error } = await supabase.from('games').select('id, name, platform');
  if (error) {
    console.error('게임 목록 조회 실패:', error.message);
    return;
  }

  for (const game of games) {
    const igdbGame = await fetchIgdbData(game.name, token);

    if (!igdbGame) {
      console.log(`매칭 실패: ${game.name}`);
      continue;
    }

    const genres = igdbGame.genres?.map((g) => g.name) || [];
    const themes = igdbGame.themes?.map((t) => t.name) || [];
    const developer = igdbGame.involved_companies?.find((c) => c.developer)?.company?.name || null;
    const publisher = igdbGame.involved_companies?.find((c) => c.publisher)?.company?.name || null;
    const criticScore = igdbGame.aggregated_rating ? Math.round(igdbGame.aggregated_rating) : null;

    const update = { genres, themes, critic_score: criticScore, developer, publisher };

    // 플랫폼은 기본값(steam만)일 때만 덮어씀 — 수동으로 정확하게 채운 건 안 건드림
    const isDefaultPlatform =
      !game.platform || (game.platform.length === 1 && game.platform[0] === 'steam');
    if (isDefaultPlatform) {
      const detectedPlatforms = mapPlatforms(igdbGame.platforms);
      if (detectedPlatforms.length > 0) update.platform = detectedPlatforms;
    }

    const { error: updateError } = await supabase.from('games').update(update).eq('id', game.id);

    if (updateError) {
      console.error(`업데이트 실패 (${game.name}):`, updateError.message);
    } else {
      console.log(`업데이트 성공: ${game.name} — 플랫폼: ${update.platform?.join(',') || '(유지)'}`);
    }

    await new Promise((r) => setTimeout(r, 300));
  }
}

main();