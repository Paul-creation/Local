'use client';

import { useComparePick } from '../lib/compareStore';

// 헤더 "비교" 메뉴 옆 담긴 개수 (0개면 숨김)
export default function CompareCount() {
  const { ids } = useComparePick();
  if (!ids.length) return null;
  return <span className="nav-count num" aria-label={`비교함에 ${ids.length}개`}>{ids.length}</span>;
}
