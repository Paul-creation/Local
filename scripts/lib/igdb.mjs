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

// ── IGDB 게임 → games 칸 값 (enrich-igdb·fix-igdb-mismatch 공통) ──
const PLATFORM_MAP = {
  'pc (microsoft windows)': 'steam', 'mac': 'steam', 'linux': 'steam',
  'playstation 4': 'ps4', 'playstation 5': 'ps5',
  'xbox one': 'xbox', 'xbox series x|s': 'xbox',
  'nintendo switch': 'switch',
};
const STORE_CODES = ['epic', 'battlenet', 'riot'];

export function mapPlatforms(igdbPlatforms = []) {
  const codes = new Set();
  igdbPlatforms.forEach((p) => {
    const code = PLATFORM_MAP[p.name?.toLowerCase()];
    if (code) codes.add(code);
  });
  return Array.from(codes);
}

// IGDB 게임 한 개에서 장르·테마·평점·개발사·배급사 (없으면 빈 배열·null)
export function igdbValues(ig) {
  return {
    genres: ig.genres?.map((g) => g.name) || [],
    themes: ig.themes?.map((t) => t.name) || [],
    critic_score: ig.aggregated_rating ? Math.round(ig.aggregated_rating) : null,
    developer: ig.involved_companies?.find((c) => c.developer)?.company?.name || null,
    publisher: ig.involved_companies?.find((c) => c.publisher)?.company?.name || null,
  };
}

// 플랫폼: 스토어(epic·battlenet·riot)는 그대로 두고, IGDB가 알려 준 플랫폼을 더한다. IGDB 값이 없으면 null
export function derivePlatform(currentPlatform, igdbPlatforms, hasSteamAppid) {
  const detected = mapPlatforms(igdbPlatforms);
  if (detected.length === 0) return null;
  const stores = (currentPlatform || []).filter((c) => STORE_CODES.includes(c));
  const mapped = hasSteamAppid ? detected : detected.filter((c) => c !== 'steam');
  return Array.from(new Set([...stores, ...mapped]));
}

// 칸이 비었는지 (null·빈 문자열·빈 배열)
export const isBlank = (v) => v == null || v === '' || (Array.isArray(v) && v.length === 0);

// 이름 비교용: 대소문자·공백·기호를 없앤 뒤 같은지 (영문·숫자·한글만 남김)
const normName = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9가-힣]/g, '');
export const sameName = (a, b) => { const x = normName(a); return x !== '' && x === normName(b); };
