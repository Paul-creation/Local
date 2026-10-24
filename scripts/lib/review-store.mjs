// scripts/lib/review-store.mjs
// appreviews가 막혔을 때(302 등) 상점 페이지의 "All Reviews" 줄에서 전체 평가(문구·%·개수)를 읽는다
// - 이 줄은 모든 언어 합계라 appreviews(language=all)와 같은 값이다. 하지만 스팀은 리뷰가 많은 게임에는 이 줄 대신
//   "English Reviews"처럼 언어별 줄만 보여준다(CS2: 상점 영어 2,638,603개 vs 전체 9,937,470개) — 그 경우는 값이 달라서 null(실패)로 둔다
// - 영어 페이지(l=english&cc=us)로 읽어 문구는 REVIEW_LABELS가 한국어로 바꾼다
import { steamGet } from './steam.mjs';

export const storeReviewsUrl = (appid) => `https://store.steampowered.com/app/${appid}/?l=english&cc=us`;
const HEADERS = { Cookie: 'birthtime=0; lastagecheckage=1-0-1990; wants_mature_content=1; Steam_Language=english' };

// html → { total_reviews, positive_percent, review_score_desc } 또는 null (All Reviews 줄이 없음)
export function parseAllReviews(html) {
  const at = html.indexOf('All Reviews:');
  if (at < 0) return null;
  const before = html.slice(Math.max(0, at - 1200), at);
  const tip = [...before.matchAll(/data-tooltip-html="([^"]*)"/g)].pop()?.[1] || '';
  const m = tip.match(/^(\d+)% of the ([\d,]+) user reviews for this game are positive/);
  const desc = html.slice(at, at + 600).match(/class="game_review_summary[^"]*"[^>]*>([^<]+)</)?.[1]?.trim();
  if (!m || !desc) return null;
  return { total_reviews: Number(m[2].replace(/,/g, '')), positive_percent: Number(m[1]), review_score_desc: desc };
}

// 요청이 실패하거나 상점 페이지가 아니거나 All Reviews 줄이 없으면 null (재시도 없음)
export async function fetchStoreReviews(appid, { get = steamGet } = {}) {
  try {
    const html = await get(storeReviewsUrl(appid), { text: true, headers: HEADERS, waits: [], gapMs: 1000 });
    if (!html.includes('game_area_purchase') && !html.includes('user_reviews_summary_row')) return null;
    return parseAllReviews(html);
  } catch {
    return null;
  }
}
