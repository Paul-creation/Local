'use client';

import { useWishlist } from './useWishlist';

// "찜목록에 담기" 토글 — 상세 가격 카드와 비교 페이지 게임 칸에서 쓴다
// 담긴 상태는 색만이 아니라 문구("찜목록에 담김")와 aria-pressed로도 구분
export default function WishlistButton({ gameId, className = '' }: { gameId: string; className?: string }) {
  const { ready, has, toggle } = useWishlist();
  const on = ready && has(gameId);
  return (
    <button type="button" className={`btn btn-outline wishlist-btn ${className}`.trim()} onClick={() => toggle(gameId)} aria-pressed={on}>
      {on ? '찜목록에 담김' : '찜목록에 담기'}
    </button>
  );
}
