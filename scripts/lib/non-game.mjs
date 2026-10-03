// scripts/lib/non-game.mjs
// 스팀 공식 장르로 "게임이 아닌 프로그램"(유틸리티, 제작 툴 등)인지 판단 — find-non-games, bulk-import가 같이 씀
// 소프트웨어 계열 장르가 있고 게임 장르가 하나도 없으면 프로그램
// Indie는 장르가 아니라 제작 형태라 게임 장르로 치지 않음 (예: Mouse X = Indie + Utilities)

export const SOFTWARE_GENRES = ['Utilities', 'Design & Illustration', 'Animation & Modeling', 'Audio Production',
  'Video Production', 'Photo Editing', 'Web Publishing', 'Education', 'Software Training',
  'Accounting', 'Game Development'];
export const GAME_GENRES = ['Action', 'Adventure', 'Casual', 'RPG', 'Simulation', 'Strategy', 'Sports',
  'Racing', 'Massively Multiplayer'];

// genres: 영어 장르 이름 배열 (appdetails의 genres[].description, l=english 기준)
export function isNonGame(genres) {
  return genres.some((x) => SOFTWARE_GENRES.includes(x)) && !genres.some((x) => GAME_GENRES.includes(x));
}
