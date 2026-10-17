// scripts/lib/non-game.mjs
// 스팀 공식 장르로 "게임이 아닌 프로그램"(유틸리티, 제작 툴 등)인지 판단 — find-non-games, bulk-import가 같이 씀
// 소프트웨어 계열 장르가 있고 게임 장르가 하나도 없으면 프로그램
// Indie는 장르가 아니라 제작 형태라 게임 장르로 치지 않음 (예: Mouse X = Indie + Utilities)
// 추가 규칙(도구가 게임 장르를 같이 달고 type=game으로 등록된 경우, 예: Crosshair X = Action + Adventure + Software Training + Utilities):
//   소프트웨어 장르가 있고, (이름에 도구 단어가 있거나 / 싱글·멀티·협동·대전 카테고리가 하나도 없으면) 프로그램. name·categories를 모르면 이 규칙은 건너뜀
// 예외: Game Development(제작 툴)가 있으면 게임 장르가 같이 붙어 있어도 프로그램 (예: RPG Maker MZ = RPG + Game Development)

export const SOFTWARE_GENRES = ['Utilities', 'Design & Illustration', 'Animation & Modeling', 'Audio Production',
  'Video Production', 'Photo Editing', 'Web Publishing', 'Education', 'Software Training',
  'Accounting', 'Game Development'];
export const GAME_GENRES = ['Action', 'Adventure', 'Casual', 'RPG', 'Simulation', 'Strategy', 'Sports',
  'Racing', 'Massively Multiplayer'];

// 게임을 한다는 뜻의 스팀 카테고리 (appdetails의 categories[].description)
export const PLAY_MODE_CATEGORIES = ['Single-player', 'Multi-player', 'Co-op', 'Online Co-op', 'LAN Co-op', 'Shared/Split Screen Co-op',
  'PvP', 'Online PvP', 'LAN PvP', 'Shared/Split Screen PvP', 'Shared/Split Screen', 'MMO', 'Cross-Platform Multiplayer'];
// 이름에 이 단어가 있고 소프트웨어 장르도 있으면 도구 (오버레이·크로스헤어·벤치마크·FPS 측정 등)
export const TOOL_NAME_PATTERN = /\b(overlay|crosshair|benchmark|fps (counter|monitor|boost)|frame ?rate|wallpaper|launcher|mod ?manager|screen ?(recorder|capture)|stream ?(deck|labs))\b|3dmark/i;

// genres: 영어 장르 이름 배열 (appdetails의 genres[].description, l=english 기준)
// opts.name: 영어 이름, opts.categories: 영어 카테고리 이름 배열 (둘 다 주면 도구류 추가 규칙을 적용)
export function isNonGame(genres, opts = {}) {
  if (genres.includes('Game Development')) return true;
  const hasSoftware = genres.some((x) => SOFTWARE_GENRES.includes(x));
  if (hasSoftware && !genres.some((x) => GAME_GENRES.includes(x))) return true;
  if (!hasSoftware || !opts.name || !opts.categories) return false;
  return TOOL_NAME_PATTERN.test(opts.name) || !opts.categories.some((c) => PLAY_MODE_CATEGORIES.includes(c));
}
