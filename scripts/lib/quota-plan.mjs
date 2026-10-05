// YouTube 하루 한도(태평양 시간 자정 초기화) 배분에서 여러 스크립트가 같이 쓰는 값
// - fetch-highlight-videos: 목요일 상한 계산에 THU_TRAILER_YT_MAX × TRAILER_UNIT을 트레일러 몫으로 남김
// - run-steps: 목요일(태평양 시간) 한도일의 enrich-videos에 --yt-max=THU_TRAILER_YT_MAX를 붙임
export const TRAILER_UNIT = 100; // 트레일러 YouTube 검색 1번(search.list)
// 목요일 한도일에는 금요일 02:00 주간 작업(합방 영상, 최대 약 7,700~10,100)이 한도 대부분을 쓴다.
// 같은 날 03:00 일간 트레일러가 새 게임(bulk-import, 최대 200개) 때문에 몰려도 YouTube 검색은 이만큼만 (스팀 영상 찾기는 그대로)
export const THU_TRAILER_YT_MAX = 15;

// 태평양 시간 기준 시각·요일 (YouTube 한도일 기준)
export function pacificNow() {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles', hour: 'numeric', hourCycle: 'h23', weekday: 'short',
  }).formatToParts(new Date()).map((p) => [p.type, p.value]));
  return { hour: Number(parts.hour), weekday: parts.weekday };
}
