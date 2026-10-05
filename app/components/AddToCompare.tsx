'use client';

import { useRouter } from 'next/navigation';
import { MAX_COMPARE, COMPARE_PICK_KEY } from '../lib/compareRule';

// 상세 가격 카드 "비교에 담기" — 비교 만들기 화면(/compare)이 읽는 선택 목록에 이 게임을 넣고 그 화면으로 이동
// 이미 3개가 차 있으면 가장 먼저 담은 게임을 빼고 넣는다 (비교 만들기 화면에서 다시 고를 수 있음)
export default function AddToCompare({ gameId }: { gameId: string }) {
  const router = useRouter();
  const add = () => {
    try {
      const ids = (sessionStorage.getItem(COMPARE_PICK_KEY) || '').split(',').filter(Boolean).filter((id) => id !== gameId);
      sessionStorage.setItem(COMPARE_PICK_KEY, [...ids, gameId].slice(-MAX_COMPARE).join(','));
    } catch {}
    router.push('/compare');
  };
  return <button type="button" className="btn btn-outline btn-lg price-card-compare" onClick={add}>비교에 담기</button>;
}
