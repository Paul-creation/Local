// 비교함 — 담은 게임 id 목록 (최대 3개). 저장 방식은 그대로 sessionStorage(compare_pick): 페이지를 옮겨도·새로고침해도 유지
// 담기·빼기는 writePick으로만 → 같은 탭의 헤더 숫자·오른쪽 아래 알약·검색 카드·비교 만들기가 이벤트로 함께 바뀐다
// 알약 팝오버에 쓰는 이름·썸네일은 compare_pick_meta에 함께 기억 (없으면 알약이 한 번 불러옴)
import { useEffect, useState } from 'react';
import { MAX_COMPARE, COMPARE_PICK_KEY } from './compareRule';

export const COMPARE_EVENT = 'compare-pick-change';
const META_KEY = 'compare_pick_meta';
export type PickMeta = { id: string; name: string; thumb?: string | null };
type Detail = { ids: string[]; bump: boolean; source: string };

export function readPick(): string[] {
  try { return (sessionStorage.getItem(COMPARE_PICK_KEY) || '').split(',').filter(Boolean).slice(0, MAX_COMPARE); } catch { return []; }
}
export function readMeta(): Record<string, PickMeta> {
  try { return JSON.parse(sessionStorage.getItem(META_KEY) || '{}'); } catch { return {}; }
}

// bump: 상세에서 담았을 때 알약이 살짝 튀어 오르게 / source: 보낸 곳 (자기가 보낸 이벤트는 다시 받지 않게)
export function writePick(ids: string[], opts: { bump?: boolean; meta?: PickMeta[]; source?: string } = {}) {
  const next = [...new Set(ids)].slice(0, MAX_COMPARE);
  try {
    if (next.length) sessionStorage.setItem(COMPARE_PICK_KEY, next.join(','));
    else sessionStorage.removeItem(COMPARE_PICK_KEY);
    const meta = readMeta();
    for (const m of opts.meta || []) meta[m.id] = m;
    // 빠진 게임 정보는 같이 정리
    sessionStorage.setItem(META_KEY, JSON.stringify(Object.fromEntries(next.filter((id) => meta[id]).map((id) => [id, meta[id]]))));
  } catch {}
  window.dispatchEvent(new CustomEvent<Detail>(COMPARE_EVENT, { detail: { ids: next, bump: !!opts.bump, source: opts.source || '' } }));
  return next;
}

// 담은 목록 구독. bumpAt: 마지막으로 "튀어 오르기"를 요청한 시각
export function useComparePick() {
  const [ids, setIds] = useState<string[]>([]);
  const [bumpAt, setBumpAt] = useState(0);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 바깥(sessionStorage)에서 한 번 읽어 오는 초기화
    setIds(readPick());
    const on = (e: Event) => {
      const d = (e as CustomEvent<Detail>).detail;
      setIds(d.ids);
      if (d.bump) setBumpAt(Date.now());
    };
    window.addEventListener(COMPARE_EVENT, on);
    return () => window.removeEventListener(COMPARE_EVENT, on);
  }, []);
  return { ids, bumpAt };
}
