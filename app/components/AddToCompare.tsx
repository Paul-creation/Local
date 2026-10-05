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
      <button type="button" className="btn btn-outline btn-lg price-card-compare" onClick={add} aria-pressed={added}>
        {added ? '비교에 담김' : '비교에 담기'}
      </button>
      <p className="price-card-compare-status" role="status">
        {(added || full) && (
          <>
            {added ? `비교에 담았어요 (${ids.length}/${MAX_COMPARE})` : '비교함이 꽉 찼어요'}
            {' · '}
            <Link href={ids.length >= 2 ? `/compare?ids=${ids.join(',')}` : '/compare'}>비교하기 →</Link>
          </>
        )}
      </p>
    </>
  );
}
