'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { MAX_COMPARE, COMPARE_PICK_KEY } from '../lib/compareRule';

const readPick = () => {
  try { return (sessionStorage.getItem(COMPARE_PICK_KEY) || '').split(',').filter(Boolean); } catch { return []; }
};

// 상세 가격 카드 "비교에 담기" — 비교 만들기 화면(/compare)이 읽는 선택 목록에 이 게임을 넣고, 이동 없이 버튼 아래에 안내
// 이미 3개가 차 있으면 빼지 않고 "꽉 찼어요"만 알린다 (비교 만들기 화면에서 바꿀 수 있음)
export default function AddToCompare({ gameId }: { gameId: string }) {
  const [state, setState] = useState<{ kind: 'added' | 'full'; count: number } | null>(null);

  // 이미 담아 둔 게임이면 처음부터 안내를 보여 준다
  useEffect(() => {
    const ids = readPick();
    if (ids.includes(gameId)) setState({ kind: 'added', count: ids.length });
  }, [gameId]);

  const add = () => {
    const ids = readPick();
    if (ids.includes(gameId)) return setState({ kind: 'added', count: ids.length });
    if (ids.length >= MAX_COMPARE) return setState({ kind: 'full', count: ids.length });
    const next = [...ids, gameId];
    try { sessionStorage.setItem(COMPARE_PICK_KEY, next.join(',')); } catch {}
    setState({ kind: 'added', count: next.length });
  };

  return (
    <>
      <button type="button" className="btn btn-outline btn-lg price-card-compare" onClick={add} aria-pressed={state?.kind === 'added'}>
        {state?.kind === 'added' ? '비교에 담김' : '비교에 담기'}
      </button>
      <p className="price-card-compare-status" role="status">
        {state && (
          <>
            {state.kind === 'added' ? `비교에 담았어요 (${state.count}/${MAX_COMPARE})` : '비교함이 꽉 찼어요'}
            {' · '}
            <Link href="/compare">비교하기 →</Link>
          </>
        )}
      </p>
    </>
  );
}
