// scripts/lib/steam.mjs
// 스팀 상점 API 공통 호출 — 요청 간격 유지 + 429·403·5xx면 기다렸다가 최대 3번 다시 시도
// 스팀 appdetails는 5분에 약 200번까지라서 간격을 넉넉히 둔다
const REQUEST_GAP_MS = 2000; // 요청 사이 최소 간격
const MAX_RETRIES = 3;
const RETRY_WAIT_MS = [30000, 60000, 120000]; // 스팀은 막히면 몇 분 가므로 길게 기다림

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let lastRequestAt = 0;

export class SteamLimitError extends Error {}

// 성공하면 JSON. 재시도해도 안 되면 SteamLimitError, 다시 시도할 필요 없는 오류면 Error
export async function steamGet(url) {
  for (let attempt = 0; ; attempt++) {
    const wait = lastRequestAt + REQUEST_GAP_MS - Date.now();
    if (wait > 0) await sleep(wait);
    lastRequestAt = Date.now();

    let status = 0;
    let retryAfter = 0;
    try {
      const res = await fetch(url);
      status = res.status;
      if (res.ok) return await res.json();
      retryAfter = Number(res.headers.get('retry-after')) || 0;
    } catch {
      // 네트워크 오류도 다시 시도
    }

    const retryable = status === 0 || status === 429 || status === 403 || status >= 500;
    if (!retryable) throw new Error(`스팀 응답 ${status}`);
    if (attempt >= MAX_RETRIES) throw new SteamLimitError(`스팀 응답 ${status || '연결 실패'} (${MAX_RETRIES}번 재시도 후)`);
    const ms = Math.max(retryAfter * 1000, RETRY_WAIT_MS[attempt]);
    console.log(`   ⏳ 스팀 응답 ${status || '연결 실패'} — ${ms / 1000}초 기다렸다가 다시 시도 (${attempt + 1}/${MAX_RETRIES})`);
    await sleep(ms);
  }
}

export function appdetailsUrl(appid, lang = 'korean') {
  return `https://store.steampowered.com/api/appdetails?appids=${appid}&cc=kr&l=${lang}`;
}
