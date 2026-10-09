// 스팀 보유 게임 조회 (IPlayerService/GetOwnedGames) — 순수 함수 + fetch, DB 접근 없음 (saving은 user/index.ts)
// 응답 판별:
//  - games 배열이 있으면 공개 → appid 목록
//  - 비공개(게임 세부 정보 비공개)이면 HTTP 200이어도 response가 빈 객체({}) 이거나 games 칸이 없다 → private (기존 캐시를 덮어쓰지 않는 쪽으로 처리)
//  - 예외: game_count가 숫자 0이고 games가 없으면 공개 + 0개로 본다 (공개 프로필에 게임이 없을 때의 모양, 실제 응답으로는 아직 못 봄)
//  - HTTP 오류·JSON 오류·시간 초과는 error (아무것도 바꾸지 않고 다음에 다시 시도)
// 키가 들어 있는 주소는 로그에 남기지 않는다
export type OwnedFetch = { kind: 'public'; appids: number[] } | { kind: 'private' } | { kind: 'error' };

const MAX_APPID = 2147483647; // user_owned_games.steam_appid가 integer

export function parseOwnedGames(json: unknown): OwnedFetch {
  const res = (json && typeof json === 'object' ? (json as { response?: unknown }).response : undefined);
  if (!res || typeof res !== 'object') return { kind: 'private' };
  const r = res as { games?: unknown; game_count?: unknown };
  if (Array.isArray(r.games)) {
    const ids = new Set<number>();
    for (const g of r.games) {
      const a = (g as { appid?: unknown })?.appid;
      if (typeof a === 'number' && Number.isInteger(a) && a > 0 && a <= MAX_APPID) ids.add(a);
    }
    return { kind: 'public', appids: [...ids] };
  }
  if (r.game_count === 0) return { kind: 'public', appids: [] };
  return { kind: 'private' };
}

export async function fetchOwnedGames(steamId: string, apiKey: string | undefined, fetchImpl: typeof fetch = fetch): Promise<OwnedFetch> {
  if (!apiKey || !/^\d{17}$/.test(steamId)) return { kind: 'error' };
  try {
    const url = `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${encodeURIComponent(apiKey)}&steamid=${steamId}&include_played_free_games=1&format=json`;
    const res = await fetchImpl(url, { cache: 'no-store', signal: AbortSignal.timeout(4500) });
    if (!res.ok) return { kind: 'error' };
    return parseOwnedGames(await res.json());
  } catch {
    return { kind: 'error' };
  }
}
