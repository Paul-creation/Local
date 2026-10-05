'use client';

import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { MY_PC_KEY, parseMyPc, serializeMyPc, type MyPc } from '../../lib/myPc';

// 내 PC 사양 저장 훅 — localStorage에만 저장 (서버 전송 없음). 읽기·쓰기는 모두 try/catch
// 패널과 판정 줄이 같은 값을 보도록 같은 탭 안에서는 직접 만든 이벤트로, 다른 탭과는 storage 이벤트로 알린다
// 저장소를 못 쓰는 환경(사생활 보호 모드 등)에서는 이 탭이 열려 있는 동안만 메모리에 둔다
// 4단계 검색 필터에서도 그대로 쓸 수 있다: const { pc, ready, save, clear } = useMyPc()
const EVENT = 'my-pc-spec-change';
let memory: string | null = null;

function readRaw(): string | null {
  try { return window.localStorage.getItem(MY_PC_KEY) ?? memory; } catch { return memory; }
}
function subscribe(cb: () => void) {
  const onStorage = (e: StorageEvent) => { if (e.key === MY_PC_KEY || e.key === null) cb(); };
  window.addEventListener('storage', onStorage);
  window.addEventListener(EVENT, cb);
  return () => { window.removeEventListener('storage', onStorage); window.removeEventListener(EVENT, cb); };
}
const notify = () => window.dispatchEvent(new Event(EVENT));

export function useMyPc() {
  // 서버·첫 화면에서는 undefined(아직 모름) → 마운트 뒤 저장된 값(없으면 null)으로 바뀐다 (hydration 불일치 방지)
  const raw = useSyncExternalStore<string | null | undefined>(subscribe, readRaw, () => undefined);
  const pc = useMemo(() => (raw ? parseMyPc(raw) : null), [raw]); // 깨진 값도 null = 미입력
  const save = useCallback((next: MyPc) => {
    const s = serializeMyPc(next);
    memory = s;
    try { window.localStorage.setItem(MY_PC_KEY, s); } catch { /* 저장소를 못 쓰면 이 탭에서만 유지 */ }
    notify();
  }, []);
  const clear = useCallback(() => {
    memory = null;
    try { window.localStorage.removeItem(MY_PC_KEY); } catch { /* 무시 */ }
    notify();
  }, []);
  return { pc, ready: raw !== undefined, save, clear };
}
