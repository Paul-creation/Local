'use client';

import { useCallback, useEffect, useState } from 'react';

// 메인 검색·필터용 전체 게임 목록을 첫 화면 뒤에 받아 온다 (/api/games/list, 5분 캐시)
// 받은 목록은 탭 안에서 5분 동안 기억 → 상세에서 "목록으로" 돌아오면 다시 받지 않고 바로 결과를 그린다
const KEEP_MS = 5 * 60 * 1000;
let cached: { at: number; games: any[] } | null = null;
let inflight: Promise<any[]> | null = null;

const fresh = () => (cached && Date.now() - cached.at < KEEP_MS ? cached.games : null);

function load() {
  if (!inflight) {
    inflight = fetch('/api/games/list')
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then((games: any[]) => {
        cached = { at: Date.now(), games };
        return games;
      })
      .finally(() => { inflight = null; });
  }
  return inflight;
}

export function useGameIndex() {
  const [games, setGames] = useState<any[] | null>(fresh);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (games) return;
    let alive = true;
    load()
      .then((g) => { if (alive) setGames(g); })
      .catch(() => { if (alive) setError(true); });
    return () => { alive = false; };
  }, [games, attempt]);

  const retry = useCallback(() => { setError(false); setAttempt((n) => n + 1); }, []);
  return { games, error, retry };
}

export type GameIndex = ReturnType<typeof useGameIndex>;
