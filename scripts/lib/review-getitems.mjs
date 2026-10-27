// scripts/lib/review-getitems.mjs
// appreviews가 막혔을 때 스팀 IStoreBrowseService/GetItems/v1(키 없이 호출, GET만)의 reviews.summary_filtered(전체 언어)로 리뷰 요약을 받는다
// - 한 요청에 appid 여러 개 (200개까지 확인, 여기서는 100개씩)
// - review_count는 appreviews와 기준이 조금 다를 수 있음 (It Takes Two: 220,441 vs 272,541) → review_source에 'getitems'로 기록하고 appreviews가 돌아오면 덮어씀
import { steamGet } from './steam.mjs';

export const GETITEMS_CHUNK = 100;
export const getItemsUrl = (appids, country = 'US') => {
  const input = { ids: appids.map((appid) => ({ appid: Number(appid) })), context: { language: 'english', country_code: country }, data_request: { include_reviews: true } };
  return `https://api.steampowered.com/IStoreBrowseService/GetItems/v1/?input_json=${encodeURIComponent(JSON.stringify(input))}`;
};

// 응답 JSON → Map(appid 문자열 → { total_reviews, positive_percent, review_score_desc }). 리뷰 요약이 없거나 개수 0인 앱은 넣지 않음
export function parseGetItems(json) {
  const out = new Map();
  for (const it of json?.response?.store_items ?? []) {
    const s = it?.success === 1 ? it.reviews?.summary_filtered : null;
    if (!s || !(s.review_count > 0) || typeof s.percent_positive !== 'number' || !s.review_score_label) continue;
    out.set(String(it.appid ?? it.id), { total_reviews: s.review_count, positive_percent: s.percent_positive, review_score_desc: s.review_score_label });
  }
  return out;
}

// 미국 스토어에서 볼 수 없는 앱(일본·한국·중국 퍼블리셔 게임 등)은 US 기준 응답에 success: 15가 옴 — 한국 기준으로는 리뷰가 옴
export const NOT_AVAILABLE = 15;
export function parseUnavailable(json) {
  const out = [];
  for (const it of json?.response?.store_items ?? []) if (it?.success === NOT_AVAILABLE) out.push(String(it.appid ?? it.id));
  return out;
}

// appid 목록 → Map. 요청이 실패한 묶음은 건너뜀(재시도 없음)
export async function fetchGetItemsReviews(appids, { get = steamGet, chunk = GETITEMS_CHUNK } = {}) {
  const out = new Map();
  for (let i = 0; i < appids.length; i += chunk) {
    try {
      const json = await get(getItemsUrl(appids.slice(i, i + chunk)), { waits: [], gapMs: 1000 });
      for (const [k, v] of parseGetItems(json)) out.set(k, v);
    } catch { /* 이 묶음은 건너뜀 */ }
  }
  return out;
}

// US 기준 GetItems로 받고, success 15(조회 불가)였던 appid만 모아 KR 기준으로 한 번 더 부른다. KR도 안 되면 값 없음(기존 값 유지·실패로 셈)
// 요청이 아예 실패한 묶음은 건너뜀(조회 불가 여부를 모르므로 KR 재시도 대상이 아님). 돌려주는 값: { reviews: Map, krRetried: KR로 다시 부른 appid 수, krRecovered: 그중 값을 받은 수 }
export async function fetchGetItemsReviewsWithKr(appids, { get = steamGet, chunk = GETITEMS_CHUNK } = {}) {
  const reviews = new Map();
  const unavailable = [];
  for (let i = 0; i < appids.length; i += chunk) {
    try {
      const json = await get(getItemsUrl(appids.slice(i, i + chunk)), { waits: [], gapMs: 1000 });
      for (const [k, v] of parseGetItems(json)) reviews.set(k, v);
      unavailable.push(...parseUnavailable(json));
    } catch { /* 이 묶음은 건너뜀 */ }
  }
  let krRecovered = 0;
  for (let i = 0; i < unavailable.length; i += chunk) {
    const ask = unavailable.slice(i, i + chunk);
    try {
      const json = await get(getItemsUrl(ask, 'KR'), { waits: [], gapMs: 1000 });
      const kr = parseGetItems(json);
      for (const id of ask) if (kr.has(id)) { reviews.set(id, kr.get(id)); krRecovered++; } // 요청한 appid만 받아들임
    } catch { /* KR도 막히면 기존 값 유지 */ }
  }
  return { reviews, krRetried: unavailable.length, krRecovered };
}
