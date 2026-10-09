// 메인 "인원별 추천"에서 보여줄 게임 고르기 (순수 함수 — 테스트에서 바로 불러 쓰려고 다른 파일을 가져오지 않는다)
// 서버는 인원별로 후보 PEOPLE_CANDIDATES개를 날짜 시드 순서로 보내고, 브라우저가 앞에서부터 PEOPLE_SHOW개를 보여준다
// - 내 PC 필터 꺼짐(runs 없음) → 후보 앞 3개
// - 켜짐·통과 1개 이상 → 통과한 게임만 앞에서부터 최대 3개 (1~2개면 그만큼만 — 통과 못 한 후보로 채우지 않는다)
// - 켜짐·통과 0개 → 필터 전 앞 3개 + filteredOut(화면이 "사양을 통과한 추천이 없어 전체 추천을 보여줘요" 안내와 필터 끄기 버튼을 보임)
export const PEOPLE_SHOW = 3;
export const PEOPLE_CANDIDATES = 12;

export function choosePeopleGames<T>(candidates: T[], runs: ((g: T) => boolean) | null, show = PEOPLE_SHOW): { games: T[]; filteredOut: boolean } {
  if (!runs) return { games: candidates.slice(0, show), filteredOut: false };
  const passed = candidates.filter(runs);
  // 후보는 있는데 통과가 하나도 없는 경우 — "데이터 없음"과 다른 안내를 하려고 구분
  if (passed.length === 0) return { games: candidates.slice(0, show), filteredOut: candidates.length > 0 };
  return { games: passed.slice(0, show), filteredOut: false };
}
