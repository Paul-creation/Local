// scripts/lib/steam.mjs
// 스팀 상점 API 공통 호출 — 요청 간격 유지 + 429·403·5xx·빈 응답이면 기다렸다가 최대 3번 다시 시도 (30초 → 60초 → 120초, 두 배씩)
// 스팀 appdetails는 5분에 약 200번까지라서 간격을 넉넉히 둔다
const REQUEST_GAP_MS = 2000; // 요청 사이 최소 간격
const RETRY_WAIT_MS = [30000, 60000, 120000]; // 스팀은 막히면 몇 분 가므로 길게 기다림

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let lastRequestAt = 0;

export class SteamLimitError extends Error {}

// 성공하면 JSON(text: true면 문자열). 재시도해도 안 되면 SteamLimitError, 다시 시도할 필요 없는 오류면 Error
// - 본문이 비었거나 JSON이 아니면 "빈 응답"으로 보고 다시 시도 (요청 제한 때 스팀이 이렇게 주기도 함)
// - retryIf(본문): true면 그 응답도 빈 응답처럼 다시 시도 (예: appdetails에 요청한 앱 번호 칸이 아예 없을 때)
// - waits: 재시도 대기(ms) 배열 — 길이가 최대 재시도 횟수. 기본 [30000, 60000, 120000]. gapMs: 요청 사이 최소 간격 (둘 다 테스트에서 짧게 줄일 때 씀)
export async function steamGet(url, { text = false, headers, retryIf, waits = RETRY_WAIT_MS, gapMs = REQUEST_GAP_MS } = {}) {
  const maxRetries = waits.length;
  for (let attempt = 0; ; attempt++) {
    const wait = lastRequestAt + gapMs - Date.now();
    if (wait > 0) await sleep(wait);
    lastRequestAt = Date.now();

    let status = 0;
    let retryAfter = 0;
    let label = '';
    try {
      const res = await fetch(url, headers ? { headers } : undefined);
      status = res.status;
      if (res.ok) {
        let body;
        try { body = text ? await res.text() : await res.json(); } catch { body = undefined; }
        const empty = body === undefined || body === null || (text && body === '') || (retryIf && retryIf(body));
        if (!empty) return body;
        status = 0; // 200인데 내용이 없음 → 요청 제한으로 보고 다시 시도
        label = '빈 응답';
      } else {
        retryAfter = Number(res.headers.get('retry-after')) || 0;
      }
    } catch {
      // 네트워크 오류도 다시 시도
    }

    const retryable = status === 0 || status === 429 || status === 403 || status >= 500;
    if (!retryable) throw new Error(`스팀 응답 ${status}`);
    const what = label || status || '연결 실패';
    if (attempt >= maxRetries) throw new SteamLimitError(`스팀 응답 ${what} (${maxRetries}번 재시도 후)`);
    const ms = Math.max(retryAfter * 1000, waits[attempt]);
    console.log(`   ⏳ 스팀 응답 ${what} — ${ms / 1000}초 기다렸다가 다시 시도 (${attempt + 1}/${maxRetries})`);
    await sleep(ms);
  }
}

export function appdetailsUrl(appid, lang = 'korean') {
  return `https://store.steampowered.com/api/appdetails?appids=${appid}&cc=kr&l=${lang}`;
}
