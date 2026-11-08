// 스팀 카테고리 "Shared/Split Screen"(ID 24) — games.steam_categories(영어 원문)에 저장돼 있다. 상세 플레이 방식의 "화면 분할" 칩에만 쓴다(카드 칩은 그대로)
export function hasSplitScreen(game: { steam_categories?: string[] | null }): boolean {
  return Array.isArray(game.steam_categories) && game.steam_categories.includes('Shared/Split Screen');
}
