// scripts/lib/review-fetch.mjs
// 스팀 appreviews 조회 — 큐레이터 경로는 막혀도(302·429·빈 응답) 재시도 없이 null로 건너뜀
// 일반 수집 경로는 steamGet의 재시도를 그대로 쓰고 끝까지 실패하면 던짐 (리뷰 필수)
// 큐레이터 게임의 review 칸은 비운 채 들어가고, 매일 도는 갱신(데일리)이 채움
import { steamGet } from './steam.mjs';

export const reviewsUrl = (appid) =>
  `https://store.steampowered.com/appreviews/${appid}?json=1&filter=summary&language=all&purchase_type=all`;

// 반환: query_summary 또는 undefined(리뷰 정보 없음). 큐레이터 경로에서 조회가 실패하면 null
export async function fetchReviewSummary(appid, { curator = false, get = steamGet } = {}) {
  if (!curator) return (await get(reviewsUrl(appid)))?.query_summary;
  try {
    return (await get(reviewsUrl(appid), { waits: [] }))?.query_summary;
  } catch {
    return null;
  }
}
