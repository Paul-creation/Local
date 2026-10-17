// 내 라이브러리 "친구랑 할 게임" — 보유 게임 중 온라인 협동·대전이 되는 게임을 인원에 맞는 것 먼저, 인기순으로 정렬 (순수 함수, 다른 파일을 가져오지 않음)
type G = { id: string; has_online_coop?: boolean | null; has_pvp?: boolean | null; min_players?: number | null; max_players?: number | null; party_max?: number | null; heat_rank?: number | null };

// 온라인 협동 또는 대전이 확인된 게임 (1인 전용은 뺌)
export const isFriendGame = (g: G) => g.max_players !== 1 && (g.has_online_coop === true || g.has_pvp === true);

// 친구끼리 최대 인원은 party_max가 있으면 그것, 없으면 max_players (app/lib/playersMatch.friendsMax와 같은 규칙). n=5는 "5인 이상"
export function fitsPeopleCount(g: G, n: number) {
  const max = g.party_max ?? g.max_players ?? null;
  if (!max) return false;
  return n >= 5 ? max >= 5 : (g.min_players || 1) <= n && max >= n;
}

// 인원에 맞는 게임 → 안 맞는 게임, 각각 인기순(heat_rank 작은 순, 없으면 뒤, 같으면 id)
export function friendGames<T extends G>(owned: readonly T[], n: number): { fit: T[]; other: T[] } {
  const byPop = (a: T, b: T) => (a.heat_rank ?? Infinity) - (b.heat_rank ?? Infinity) || (a.id < b.id ? -1 : 1);
  const list = owned.filter(isFriendGame);
  return { fit: list.filter((g) => fitsPeopleCount(g, n)).sort(byPop), other: list.filter((g) => !fitsPeopleCount(g, n)).sort(byPop) };
}
