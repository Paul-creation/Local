'use client';

import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { WISHLIST_KEY, MAX_WISHLIST, cleanIds, parseWishlist } from '../../lib/wishlist';

// 찜목록 훅 — localStorage에만 저장 (서버 전송 없음). 읽기·쓰기는 모두 try/catch, 값이 깨져 있으면 빈 배열
// 같은 탭 안에서는 직접 만든 이벤트로, 다른 탭과는 storage 이벤트로 알려서 버튼·목록이 같은 값을 보게 한다
// 저장소를 못 쓰는 환경(사생활 보호 모드 등)에서는 이 탭이 열려 있는 동안만 메모리에 둔다
// 사용: const { ids, ready, has, toggle, merge } = useWishlist()
const EVENT = 'wishlist-change';
let memory: string | null = null;

function readRaw(): string | null {
  try { return window.localStorage.getItem(WISHLIST_KEY) ?? memory; } catch { return memory; }
}
function subscribe(cb: () => void) {
  const onStorage = (e: StorageEvent) => { if (e.key === WISHLIST_KEY || e.key === null) cb(); };
  window.addEventListener('storage', onStorage);
  window.addEventListener(EVENT, cb);
  return () => { window.removeEventListener('storage', onStorage); window.removeEventListener(EVENT, cb); };
}
function write(next: string[]) {
  const value = JSON.stringify(next.slice(0, MAX_WISHLIST));
  memory = value;
  try { window.localStorage.setItem(WISHLIST_KEY, value); } catch { /* 저장소를 못 쓰면 이 탭에서만 유지 */ }
  window.dispatchEvent(new Event(EVENT));
}

export function useWishlist() {
  // 서버·첫 화면에서는 undefined(아직 모름) → 마운트 뒤 저장된 값으로 바뀐다 (hydration 불일치 방지)
  const raw = useSyncExternalStore<string | null | undefined>(subscribe, readRaw, () => undefined);
  const ids = useMemo(() => (raw ? parseWishlist(raw) : []), [raw]);

  const toggle = useCallback((id: string) => {
    const now = parseWishlist(readRaw());
    write(now.includes(id) ? now.filter((x) => x !== id) : [...now, id]);
  }, []);
  // 공유받은 목록 합치기: 이미 있는 건 그대로 두고 없는 것만 뒤에 붙인다
  const merge = useCallback((add: string[]) => write(cleanIds([...parseWishlist(readRaw()), ...add])), []);
  return { ids, ready: raw !== undefined, has: (id: string) => ids.includes(id), toggle, merge };
}
