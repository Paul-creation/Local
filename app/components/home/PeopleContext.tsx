'use client';

import { createContext, useCallback, useContext, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { PEOPLE_CHOICES, type PeopleN } from '../../lib/peopleRecs';

// 메인 인원 선택 상태 — 선택한 인원은 localStorage(people-n)에 저장해 다음 방문에 복원한다 (읽기·쓰기 모두 try/catch, 저장소를 못 쓰면 이 탭에서만 유지)
// 첫 화면(서버)은 2인 → 마운트 뒤 저장된 값으로 바뀐다 (hydration 불일치 방지)
// "내 PC로 돌아가는 게임만" 토글은 인원별 추천에만 쓰이고 스트리머 섹션에는 걸지 않는다
const KEY = 'people-n';
const EVENT = 'people-n-change';
let memory: string | null = null;

const readRaw = (): string | null => { try { return window.localStorage.getItem(KEY) ?? memory; } catch { return memory; } };
function subscribe(cb: () => void) {
  const onStorage = (e: StorageEvent) => { if (e.key === KEY || e.key === null) cb(); };
  window.addEventListener('storage', onStorage);
  window.addEventListener(EVENT, cb);
  return () => { window.removeEventListener('storage', onStorage); window.removeEventListener(EVENT, cb); };
}
const parse = (raw: string | null | undefined): PeopleN => {
  const n = Number(raw);
  return (PEOPLE_CHOICES as readonly number[]).includes(n) ? (n as PeopleN) : 2;
};

type Value = { n: PeopleN; setN: (n: PeopleN) => void; myPcOn: boolean; setMyPcOn: (v: boolean) => void };
const Ctx = createContext<Value>({ n: 2, setN: () => {}, myPcOn: true, setMyPcOn: () => {} });
export const usePeople = () => useContext(Ctx);

export default function PeopleProvider({ children }: { children: ReactNode }) {
  const raw = useSyncExternalStore<string | null>(subscribe, readRaw, () => null);
  const [myPcOn, setMyPcOn] = useState(true);
  const setN = useCallback((n: PeopleN) => {
    memory = String(n);
    try { window.localStorage.setItem(KEY, memory); } catch { /* 저장소를 못 쓰면 이 탭에서만 유지 */ }
    window.dispatchEvent(new Event(EVENT));
  }, []);
  const value = useMemo(() => ({ n: parse(raw), setN, myPcOn, setMyPcOn }), [raw, setN, myPcOn]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
