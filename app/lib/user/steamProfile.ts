// 스팀 닉네임·아바타 조회 (GetPlayerSummaries) — STEAM_API_KEY가 없거나 실패하면 null (로그인은 그대로 진행)
// 키가 들어 있는 주소는 로그에 남기지 않는다. 서버 전용 모듈(user/index.ts)에서만 부른다.
export type SteamProfile = { persona_name: string | null; avatar_url: string | null };

// 아바타는 스팀 이미지 서버 주소만 받는다 (그 밖의 주소는 저장하지 않음)
const AVATAR_HOST = /^(?:[a-z0-9-]+\.)*(?:steamstatic\.com|akamaihd\.net)$/i;

export function cleanProfile(player: unknown): SteamProfile {
  const o = (player && typeof player === 'object' ? player : {}) as Record<string, unknown>;
  const name = typeof o.personaname === 'string' ? [...o.personaname.replace(/[\u0000-\u001f\u007f]/g, '').trim()].slice(0, 64).join('') : '';
  let avatar: string | null = null;
  if (typeof o.avatarmedium === 'string' || typeof o.avatar === 'string') {
    try {
      const u = new URL((o.avatarmedium || o.avatar) as string);
      if (u.protocol === 'https:' && AVATAR_HOST.test(u.hostname) && u.href.length <= 300) avatar = u.href;
    } catch { /* 형식이 이상하면 저장 안 함 */ }
  }
  return { persona_name: name || null, avatar_url: avatar };
}

export async function fetchSteamProfile(steamId: string, apiKey: string | undefined, fetchImpl: typeof fetch = fetch): Promise<SteamProfile | null> {
  if (!apiKey || !/^\d{17}$/.test(steamId)) return null;
  try {
    const url = `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${encodeURIComponent(apiKey)}&steamids=${steamId}`;
    const res = await fetchImpl(url, { cache: 'no-store', signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    const json = await res.json();
    const player = json?.response?.players?.[0];
    return player ? cleanProfile(player) : null;
  } catch {
    return null;
  }
}
