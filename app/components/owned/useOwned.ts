'use client';

import { useEffect, useSyncExternalStore } from 'react';

// 내 보유 게임(스팀 appid) — 로그인 상태에서만 /api/me/owned를 한 번 불러 모든 카드·헤더가 같이 쓴다.
// 페이지 캐시(revalidate)를 깨지 않으려고 서버 렌더링에서는 읽지 않고, 결과는 sessionStorage에 5분 기억한다.
// 로그인 표시 쿠키(logged_in=1, 값에 개인정보 없음)가 없으면 서버에 묻지 않는다
export type OwnedVisibility = 'public' | 'private' | 'unknown';
type Snap = { ready: boolean; visibility: OwnedVisibility | null; set: ReadonlySet<number> };

const CACHE_KEY = 'owned_games';
const CACHE_MS = 5 * 60 * 1000;
const EMPTY: Snap = { ready: false, visibility: null, set: new Set() };
const LOGGED_OUT: Snap = { ready: true, visibility: null, set: new Set() };

let snap: Snap = EMPTY;
let started = false;
const listeners = new Set<() => void>();
const publish = (next: Snap) => { snap = next; listeners.forEach((l) => l()); };

export const hasLoggedInCookie = () => {
  try { return /(?:^|;\s*)logged_in=1(?:;|$)/.test(document.cookie); } catch { return false; }
};
export const clearOwnedCache = () => {
  try { sessionStorage.removeItem(CACHE_KEY); } catch {}
  started = false;
  publish(EMPTY);
};

const make = (visibility: OwnedVisibility, appids: number[]): Snap => ({ ready: true, visibility, set: new Set(appids) });

function load() {
  if (started) return;
  started = true;
  if (!hasLoggedInCookie()) return publish(LOGGED_OUT);
  try {
    const c = JSON.parse(sessionStorage.getItem(CACHE_KEY) || 'null');
    if (c && Date.now() - c.at < CACHE_MS && Array.isArray(c.appids)) return publish(make(c.visibility, c.appids));
  } catch {}
  fetch('/api/me/owned', { cache: 'no-store', credentials: 'same-origin' })
    .then(async (r) => {
      if (!r.ok) return publish(LOGGED_OUT);
      const j = (await r.json()) as { visibility: OwnedVisibility; appids: number[] };
      const appids = Array.isArray(j.appids) ? j.appids.filter((n) => Number.isInteger(n)) : [];
      try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), visibility: j.visibility, appids })); } catch {}
      publish(make(j.visibility, appids));
    })
    .catch(() => { started = false; publish(LOGGED_OUT); }); // 네트워크 오류: 표시만 없이 두고, 다음 페이지에서 다시 시도
}

export function useOwned() {
  const s = useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => { listeners.delete(cb); }; },
    () => snap,
    () => EMPTY,
  );
  useEffect(() => { load(); }, []);
  // steam_appid는 목록·상세에서 문자열로 오므로 숫자로 바꿔 비교한다
  return { ready: s.ready, visibility: s.visibility, has: (appid: string | number | null | undefined) => appid != null && s.set.has(Number(appid)) };
}
