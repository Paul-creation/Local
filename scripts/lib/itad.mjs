// scripts/lib/itad.mjs
// ITAD API 공통 호출 — 요청 간격 유지 + 429·5xx면 기다렸다가 최대 3번 다시 시도
const ITAD_KEY = process.env.ITAD_API_KEY;
const REQUEST_GAP_MS = 1500; // 요청 사이 최소 간격
const MAX_RETRIES = 3;
// history/v2는 since가 없으면 최근 3개월만 준다 (날짜만 넣으면 400이라 시각까지 넣음)
const HISTORY_SINCE = '2000-01-01T00:00:00Z';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let lastRequestAt = 0;

export class ItadLimitError extends Error {}

async function itadGet(path, params) {
  const qs = new URLSearchParams({ key: ITAD_KEY, ...params });
  for (let attempt = 0; ; attempt++) {
    const wait = lastRequestAt + REQUEST_GAP_MS - Date.now();
    if (wait > 0) await sleep(wait);
    lastRequestAt = Date.now();

    let status = 0;
    let retryAfter = 0;
    try {
      const res = await fetch(`https://api.isthereanydeal.com${path}?${qs}`);
      status = res.status;
      if (res.ok) return await res.json();
      retryAfter = Number(res.headers.get('retry-after')) || 0;
    } catch {
      // 네트워크 오류도 다시 시도
    }

    const retryable = status === 0 || status === 429 || status >= 500;
    if (!retryable) throw new Error(`ITAD 응답 ${status}`);
    if (attempt >= MAX_RETRIES) throw new ItadLimitError(`ITAD 응답 ${status || '연결 실패'}`);
    await sleep(Math.max(retryAfter * 1000, 5000 * (attempt + 1)));
  }
}

// 찾으면 ITAD ID, 없으면 null. 요청 제한이면 ItadLimitError
export async function lookupItadId(params) {
  const json = await itadGet('/games/lookup/v1', params);
  return json.found ? json.game.id : null;
}

// 최신순으로 정렬된 한국 가격 기록 (과거 기록 포함)
export async function getPriceHistory(itadId) {
  const json = await itadGet('/games/history/v2', { id: itadId, country: 'KR', since: HISTORY_SINCE });
  return (Array.isArray(json) ? json : []).sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}
