// AI 추천 후보에서 내가 가진 게임을 뺀다 — 순수 함수(다른 파일을 가져오지 않음). 보유 목록은 후보를 거르는 데만 쓰고 AI 프롬프트에는 넣지 않는다
// namedByUser(g): 사용자가 답에 이 게임 이름을 직접 쓴 경우 true — 그 게임은 남긴다 (메인 노출 제외 게임과 같은 규칙, 판정은 호출하는 쪽)
type G = { steam_appid?: string | number | null };

export function dropOwned<T extends G>(games: T[], owned: ReadonlySet<number> | null, namedByUser: (g: T) => boolean): T[] {
  if (!owned || owned.size === 0) return games;
  return games.filter((g) => g.steam_appid == null || !owned.has(Number(g.steam_appid)) || namedByUser(g));
}
