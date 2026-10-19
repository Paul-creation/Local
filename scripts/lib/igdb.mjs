// scripts/lib/igdb.mjs — IGDB 호출 공통 (enrich-igdb·list-players-pending)
// 스팀 앱 ID로 찾을 때는 external_game_source = 1 (예전 category = 1은 IGDB가 없애서 항상 빈 결과였음)

export async function getIgdbToken() {
  const res = await fetch(
    `https://id.twitch.tv/oauth2/token?client_id=${process.env.IGDB_CLIENT_ID}&client_secret=${process.env.IGDB_CLIENT_SECRET}&grant_type=client_credentials`,
    { method: 'POST' }
  );
  const data = await res.json();
  return data.access_token;
}

export async function igdbQuery(endpoint, body, token) {
  const res = await fetch(`https://api.igdb.com/v4/${endpoint}`, {
    method: 'POST',
    headers: {
      'Client-ID': process.env.IGDB_CLIENT_ID,
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
    body,
  });
  return res.json();
}

// external_games 조회 본문: 스팀(source 1)에 등록된 앱 ID로 IGDB 게임을 찾는다
export const steamLookupBody = (appid, fields) => `fields ${fields}; where uid = "${appid}" & external_game_source = 1;`;

// IGDB multiplayer_modes 첫 항목에서 최대 인원 "후보값"을 뽑는다 (온라인 협동 → 로컬 협동 → 온라인 대전 순). 없으면 null
// 후보일 뿐 DB에 쓰지 않는다 — 인원은 직접 검증 결정 파일(docs/verification-rules.md)로만 넣는다
export function candidateMax(modes) {
  const m = Array.isArray(modes) ? modes[0] : modes;
  if (!m) return null;
  return m.onlinecoopmax || m.offlinecoopmax || m.onlinemax || null;
}
