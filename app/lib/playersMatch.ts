// 인원 범위 판정 (순수 함수 — 테스트에서 바로 불러 쓰려고 다른 파일을 가져오지 않는다)
// 선택한 범위와 게임의 가능 인원 범위가 하나라도 겹치면 포함: 최소 인원 ≤ 선택 최대 AND 최대 인원 ≥ 선택 최소
// 눈금: 0(상관없음)이면 아래쪽 조건 없음, 선택 최대가 끝 눈금(16명+)이면 위쪽 조건 없음
export const PLAYERS_TICK_MAX = 16;

export type PlayersGame = { min_players?: number | null; max_players?: number | null; party_max?: number | null };

// 친구끼리 같이 할 수 있는 최대 인원: 팀·파티 인원(party_max)이 있으면 그것, 없으면 최대 인원
export const friendsMax = (g: Pick<PlayersGame, 'party_max' | 'max_players'>) => g.party_max ?? g.max_players ?? null;

export function overlapsPlayers(g: PlayersGame, r: readonly [number, number], tickMax = PLAYERS_TICK_MAX) {
  if (r[0] <= 0 && r[1] >= tickMax) return true; // 상관없음~상관없음 = 필터 없음
  const max = friendsMax(g);
  if (!max) return false; // 최대 인원을 모르는 게임은 범위를 움직이면 뺀다 (예전과 같음)
  const min = g.min_players || 1; // 최소 인원이 비어 있으면 1명부터
  return (r[1] >= tickMax || min <= r[1]) && (r[0] <= 0 || max >= r[0]);
}
