// scripts/test-igdb-players.mjs 전체 교체
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function getIgdbToken() {
  const res = await fetch(
    `https://id.twitch.tv/oauth2/token?client_id=${process.env.IGDB_CLIENT_ID}&client_secret=${process.env.IGDB_CLIENT_SECRET}&grant_type=client_credentials`,
    { method: 'POST' }
  );
  const data = await res.json();
  return data.access_token;
}

async function main() {
  const token = await getIgdbToken();
  const { data: games } = await supabase.from('games').select('id, name, steam_appid');
  if (!games) return;

  for (const game of games.slice(0, 15)) {
    const res = await fetch('https://api.igdb.com/v4/games', {
      method: 'POST',
      headers: {
        'Client-ID': process.env.IGDB_CLIENT_ID,
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
      body: `fields name, multiplayer_modes.onlinecoopmax, multiplayer_modes.offlinecoopmax, multiplayer_modes.onlinemax; search "${game.name}"; limit 1;`,
    });
    const data = await res.json();
    const igdbGame = data[0];
    const modes = igdbGame?.multiplayer_modes?.[0];
    const maxPlayers = modes?.onlinecoopmax || modes?.offlinecoopmax || modes?.onlinemax;

    console.log(`${game.name}: ${maxPlayers ? `최대 ${maxPlayers}인` : '데이터 없음'}`);
    await new Promise((r) => setTimeout(r, 300));
  }
}

main();