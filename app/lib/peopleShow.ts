// 메인 "인원별 추천"에서 보여줄 게임 고르기 (순수 함수 — 테스트에서 바로 불러 쓰려고 다른 파일을 가져오지 않는다)
// 서버는 인원별로 후보 PEOPLE_CANDIDATES개를 날짜 시드 순서로 보내고, 브라우저가 앞에서부터 PEOPLE_SHOW개를 보여준다
// 내 PC 필터가 켜져 있으면(runs가 있으면) 후보 중 통과한 게임만 앞에서부터 — 앞 3개가 전부 미달이어도 뒤 후보로 채운다
export const PEOPLE_SHOW = 3;
export const PEOPLE_CANDIDATES = 12;

export function choosePeopleGames<T>(candidates: T[], runs: ((g: T) => boolean) | null, show = PEOPLE_SHOW): { games: T[]; filteredOut: boolean } {
  const games = (runs ? candidates.filter(runs) : candidates).slice(0, show);
  // 후보는 있는데 사양 필터 때문에 0개가 된 경우 — "데이터 없음"과 다른 안내를 하려고 구분
  return { games, filteredOut: !!runs && candidates.length > 0 && games.length === 0 };
}
