'use client';

import Link from 'next/link';
import { MAX_COMPARE } from '../lib/compareRule';
import { readPick, writePick, useComparePick } from '../lib/compareStore';
import { useState } from 'react';

// 상세 가격 카드 "비교에 담기" — 비교함(app/lib/compareStore)에 이 게임을 넣고, 이동 없이 버튼 아래에 안내
// 담으면 오른쪽 아래 비교함 알약이 살짝 튀어 오름. 이미 3개가 차 있으면 빼지 않고 "꽉 찼어요"만 알린다
export default function AddToCompare({ gameId, name, thumb }: { gameId: string; name: string; thumb?: string | null }) {
  const { ids } = useComparePick();
  const [full, setFull] = useState(false);
  const added = ids.includes(gameId);

  const add = () => {
    const now = readPick();
    if (now.includes(gameId)) return;
    if (now.length >= MAX_COMPARE) return setFull(true);
    setFull(false);
    writePick([...now, gameId], { bump: true, meta: [{ id: gameId, name, thumb }], source: 'detail' });
  };

  return (
    <>
      <button type="button" className="btn btn-lg price-card-compare compare-add" onClick={add} aria-pressed={added}>
        {added ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></svg>
        )}
        {added ? '비교 목록에 추가됨' : '이 게임 비교에 담기'}
      </button>
      {/* 담긴 상태일 때만 전체 폭 링크 배너, 3개가 꽉 찬 채 담으려 하면 안내 문구 */}
      <div className="price-card-compare-status" role="status">
        {added ? (
          <Link href={ids.length >= 2 ? `/compare?ids=${ids.join(',')}` : '/compare'} className="compare-banner">
            <span>비교 목록에 담김</span>
            <span className="compare-banner-count num">{ids.length}/{MAX_COMPARE} · 비교하러 가기</span>
          </Link>
        ) : full ? '비교함이 꽉 찼어요' : null}
      </div>
    </>
  );
}
