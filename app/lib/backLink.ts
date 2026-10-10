// BackLink 판정 (순수 함수 — 테스트가 .ts를 바로 불러온다, 다른 파일을 import하지 않는다)
// 사이트 안 이동 = (이 문서에서 클라이언트 이동이 1회 이상) 또는 (referrer의 출처가 같고 history.length > 1)
// 새 탭으로 연 페이지는 referrer가 같은 출처여도 history.length가 1이라 사이트 안 이동이 아니다 → 되돌아갈 곳(fallback)으로 보낸다
export function isInSiteNav(o: { clientNavs: number; referrer: string; origin: string; historyLength: number }): boolean {
  if (o.clientNavs >= 1) return true;
  let refOrigin = '';
  try { refOrigin = o.referrer ? new URL(o.referrer).origin : ''; } catch { refOrigin = ''; }
  return refOrigin !== '' && refOrigin === o.origin && o.historyLength > 1;
}

// 목록에서 들어왔을 때 저장해 둔 목록 주소(list_url)가 있으면 우선, 없거나 같은 사이트 경로가 아니면 fallback
// 같은 사이트 경로 검사는 app/lib/backPath.ts(safeBackPath)와 같은 규칙을 호출하는 쪽에서 먼저 적용한다
export function pickFallback(fallbackHref: string, savedListUrl: string | null, preferList: boolean): string {
  return preferList && savedListUrl ? savedListUrl : fallbackHref;
}
