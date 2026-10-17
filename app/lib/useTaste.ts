'use client';

import { useEffect, useState } from 'react';
import type { TasteRow } from './taste';

// 취향 추천용 게임별 태그·득표·활동(/api/games/taste, 5분 캐시) — enabled일 때(로그인한 사용자가 취향 탭을 열었을 때)만 받는다. 받은 값은 탭 안에서 5분 기억
const KEEP_MS = 5 * 60 * 1000;
let cached: { at: number; rows: TasteRow[] } | null = null;
let inflight: Promise<TasteRow[]> | null = null;

const fresh = () => (cached && Date.now() - cached.at < KEEP_MS ? cached.rows : null);

function load() {
  if (!inflight) {
    inflight = fetch('/api/games/taste')
      .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json() as Promise<TasteRow[]>; })
      .then((rows) => { cached = { at: Date.now(), rows }; return rows; })
      .finally(() => { inflight = null; });
  }
  return inflight;
}

export function useTaste(enabled: boolean) {
  const [rows, setRows] = useState<TasteRow[] | null>(fresh);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!enabled || rows) return;
    let alive = true;
    load().then((r) => { if (alive) setRows(r); }).catch(() => { if (alive) setError(true); });
    return () => { alive = false; };
  }, [enabled, rows, attempt]);
  return { rows, error, retry: () => { setError(false); setAttempt((n) => n + 1); } };
}
