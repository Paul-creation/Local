'use client';

import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import { MY_PC_KEY, parseMyPc, refreshMyPc, serializeMyPc, type MyPc } from '../../lib/myPc';
import { SPEC_TABLES_VERSION } from '../../lib/specTablesVersion';
import { loadSpecTables } from './specTables';

// 내 PC 사양 저장 훅 — localStorage에만 저장 (서버 전송 없음). 읽기·쓰기는 모두 try/catch
// 패널과 판정 줄이 같은 값을 보도록 같은 탭 안에서는 직접 만든 이벤트로, 다른 탭과는 storage 이벤트로 알린다
// 저장소를 못 쓰는 환경(사생활 보호 모드 등)에서는 이 탭이 열려 있는 동안만 메모리에 둔다
// 저장된 값의 등급표 버전(tv)이 지금 버전과 다르면 등급표를 불러와 저장된 부품 key로 등급을 다시 계산해 덮어쓴다 (key가 사라졌으면 미입력으로 지움)
//   다시 계산하는 동안에는 ready가 false라서 옛 등급으로 판정이 보이지 않는다
// 4단계 검색 필터에서도 그대로 쓸 수 있다: const { pc, ready, save, clear } = useMyPc()
const EVENT = 'my-pc-spec-change';
let memory: string | null = null;
let refreshing = false;
let refreshFailed = false; // 등급표를 못 불러왔을 때: 저장된 값은 그대로 두고 이번 방문에서는 미입력처럼 보여준다

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
function write(next: MyPc | null) {
  memory = next ? serializeMyPc(next) : null;
  try {
    if (next) window.localStorage.setItem(MY_PC_KEY, serializeMyPc(next));
    else window.localStorage.removeItem(MY_PC_KEY);
  } catch { /* 저장소를 못 쓰면 이 탭에서만 유지 */ }
  notify();
}

// 낡은 값을 다시 계산 (여러 컴포넌트가 이 훅을 써도 한 번만)
function refreshStale(stale: MyPc) {
  if (refreshing) return;
  refreshing = true;
  loadSpecTables()
    .then((t) => write(refreshMyPc(stale, { gpu: t.gpu, cpu: t.cpu }, SPEC_TABLES_VERSION)))
    .catch(() => { refreshFailed = true; notify(); })
    .finally(() => { refreshing = false; });
}

export function useMyPc() {
  // 서버·첫 화면에서는 undefined(아직 모름) → 마운트 뒤 저장된 값(없으면 null)으로 바뀐다 (hydration 불일치 방지)
  const raw = useSyncExternalStore<string | null | undefined>(subscribe, readRaw, () => undefined);
  const parsed = useMemo(() => (raw ? parseMyPc(raw) : null), [raw]); // 깨진 값도 null = 미입력
  const stale = !!parsed && parsed.tv !== SPEC_TABLES_VERSION;
  useEffect(() => { if (stale && parsed && !refreshFailed) refreshStale(parsed); }, [stale, parsed]);

  const save = useCallback((input: Pick<MyPc, 'gpu' | 'cpu' | 'ram'>) => { refreshFailed = false; write({ v: 2, tv: SPEC_TABLES_VERSION, ...input }); }, []);
  const clear = useCallback(() => write(null), []);
  return { pc: stale ? null : parsed, ready: raw !== undefined && (!stale || refreshFailed), save, clear };
}
