// scripts/lib/itad.mjs
// ITAD API 공통 호출 — 요청 간격 유지 + 429·5xx·연결 실패·30초 무응답이면 기다렸다가 최대 3번 다시 시도
// 최악의 경우 한 요청: 4번 시도 × 30초 + 대기 5+10+15초(429는 retry-after, 최대 60초) + 간격 1.5초 × 4
// 429의 retry-after가 60초를 넘으면 기다리지 않고 바로 ItadLimitError. 기다릴 때마다 한 줄 로그
const ITAD_KEY = process.env.ITAD_API_KEY;
const MAX_RETRIES = 3;
// 테스트에서만 바꿈
export const itadTuning = { gapMs: 1500, timeoutMs: 30000, backoffMs: 5000, maxRetryAfterSec: 60, log: console.log };
// history/v2는 since가 없으면 최근 3개월만 준다 (날짜만 넣으면 400이라 시각까지 넣음)
const HISTORY_SINCE = '2000-01-01T00:00:00Z';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let lastRequestAt = 0;

export class ItadLimitError extends Error {}

export async function itadGet(path, params, body) {
  const qs = new URLSearchParams({ key: ITAD_KEY, ...params });
  for (let attempt = 0; ; attempt++) {
    const wait = lastRequestAt + itadTuning.gapMs - Date.now();
    if (wait > 0) await sleep(wait);
    lastRequestAt = Date.now();

    let status = 0;
    let retryAfter = 0;
    let cause = '';
    try {
      const signal = AbortSignal.timeout(itadTuning.timeoutMs); // 본문 읽는 동안도 적용됨
      const res = await fetch(`https://api.isthereanydeal.com${path}?${qs}`, body
        ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal }
        : { signal });
      status = res.status;
      if (res.ok) return await res.json();
      retryAfter = Number(res.headers.get('retry-after')) || 0;
    } catch (e) {
      // 네트워크 오류·타임아웃도 다시 시도
      cause = e?.name === 'TimeoutError' ? '타임아웃' : '연결 실패';
    }

    const retryable = status === 0 || status === 429 || status >= 500;
    if (!retryable) throw new Error(`ITAD 응답 ${status}`);
    if (status === 429 && retryAfter > itadTuning.maxRetryAfterSec) {
      throw new ItadLimitError(`ITAD 429 retry-after ${retryAfter}초 (${itadTuning.maxRetryAfterSec}초 초과라 기다리지 않음)`);
    }
    if (attempt >= MAX_RETRIES) throw new ItadLimitError(`ITAD 응답 ${status || cause}`);
    // 429는 retry-after(초)만큼, 없거나 다른 오류면 점점 길게 기다림
    const waitMs = status === 429 && retryAfter ? retryAfter * 1000 : itadTuning.backoffMs * (attempt + 1);
    itadTuning.log(`ITAD ${status === 429 ? '429' : status ? `응답 ${status}` : cause} 대기 ${Math.round(waitMs / 1000)}초 (재시도 ${attempt + 1}/${MAX_RETRIES})`);
    await sleep(waitMs);
  }
}

// 순위·역대 최고 동접·평점. 없으면 null
export async function getGameInfo(itadId) {
  const json = await itadGet('/games/info/v2', { id: itadId });
  const metascore = json?.reviews?.find((r) => r.source === 'Metascore')?.score;
  return {
    rank: json?.stats?.rank ?? null,
    peakPlayers: json?.players?.peak ?? null,
    metascore: Number.isFinite(metascore) ? metascore : null,
  };
}

// 여러 게임의 한국 역대 최저가를 한 번에 → Map(itadId → { price, date, shop })
export async function getHistoryLows(itadIds) {
  const json = await itadGet('/games/historylow/v1', { country: 'KR' }, itadIds);
  const lows = new Map();
  for (const row of Array.isArray(json) ? json : []) {
    const amount = row.low?.price?.amount;
    if (amount >= 100) lows.set(row.id, { price: amount, date: new Date(row.low.timestamp).toISOString(), shop: row.low.shop?.name ?? null });
  }
  return lows;
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

// 여러 게임의 스팀(KR) 현재 할인 딜을 한 번에 → [{ id, deals: [{ shop, price, cut, expiry, ... }] }]
// 할인 중인 딜만(deals=true). 가격 정보가 없는 게임은 응답에서 빠질 수 있음. 한 번에 200개까지 (780개는 400이라 나눠서 보냄)
export async function getSteamDeals(itadIds) {
  const json = await itadGet('/games/prices/v3', { country: 'KR', deals: 'true', shops: '61' }, itadIds);
  return Array.isArray(json) ? json : [];
}
