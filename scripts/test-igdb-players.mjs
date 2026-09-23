// scripts/test-igdb-players.mjs
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

  // Rust로 테스트
  const query = `
    fields name, multiplayer_modes.offlinemax, multiplayer_modes.onlinemax,
           multiplayer_modes.offlinecoopmax, multiplayer_modes.onlinecoopmax,
           multiplayer_modes.lancoop, multiplayer_modes.splitscreen;
    search "Valheim";
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
  console.log(JSON.stringify(data, null, 2));
}

main();