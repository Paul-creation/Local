'use client';

import { useCallback, useEffect, useState } from 'react';
import { loadTagTree, type TagTree } from './tagTree';

// 메인 검색·필터용 전체 게임 목록과 태그 나무를 첫 화면 뒤에 받아 온다
// - 게임: /api/games/list (5분 캐시, 태그는 번호만)
// - 태그 나무·이름: app/lib/tag-search-dict.json (별도 조각으로 받아 첫 화면 JS에 싣지 않음)
// 받은 목록은 탭 안에서 5분 동안 기억 → 상세에서 "목록으로" 돌아오면 다시 받지 않고 바로 결과를 그린다
const KEEP_MS = 5 * 60 * 1000;
type Loaded = { games: any[]; tree: TagTree | null };
let cached: { at: number; data: Loaded } | null = null;
let inflight: Promise<Loaded> | null = null;

const fresh = () => (cached && Date.now() - cached.at < KEEP_MS ? cached.data : null);

function load() {
  if (!inflight) {
    const games = fetch('/api/games/list').then((r) => {
      if (!r.ok) throw new Error(String(r.status));
      return r.json() as Promise<any[]>;
    });
    // 나무를 못 받아도 목록은 보여 준다 (태그 필터만 빠짐)
    const tree = loadTagTree().catch(() => null);
    inflight = Promise.all([games, tree])
      .then(([g, t]) => {
        const data = { games: g, tree: t };
        cached = { at: Date.now(), data };
        return data;
      })
      .finally(() => { inflight = null; });
  }
  return inflight;
}

export function useGameIndex() {
  const [data, setData] = useState<Loaded | null>(fresh);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (data) return;
    let alive = true;
    load()
      .then((d) => { if (alive) setData(d); })
      .catch(() => { if (alive) setError(true); });
    return () => { alive = false; };
  }, [data, attempt]);

  const retry = useCallback(() => { setError(false); setAttempt((n) => n + 1); }, []);
  return { games: data?.games ?? null, tree: data?.tree ?? null, error, retry };
}

export type GameIndex = ReturnType<typeof useGameIndex>;
