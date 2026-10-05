'use client';

import { useWishlist } from './useWishlist';

// "찜목록에 담기" 토글 — 상세 가격 카드와 비교 페이지 게임 칸에서 쓴다
// 카드(링크) 안에서도 쓰므로 클릭이 카드 이동으로 번지지 않게 막는다 / size="sm": 비교 페이지 상단 카드용 작은 크기
// 담긴 상태는 색만이 아니라 문구("찜목록에 담김")와 aria-pressed로도 구분
export default function WishlistButton({ gameId, className = '', size }: { gameId: string; className?: string; size?: 'sm' }) {
  const { ready, has, toggle } = useWishlist();
  const on = ready && has(gameId);
  return (
    <button type="button" className={`btn btn-outline wishlist-btn${size === 'sm' ? ' is-sm' : ''} ${className}`.trim()}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggle(gameId); }} aria-pressed={on}>
      {on ? '찜목록에 담김' : '찜목록에 담기'}
    </button>
  );
}
