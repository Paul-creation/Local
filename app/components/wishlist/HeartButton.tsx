'use client';

import { useWishlist } from './useWishlist';

// 찜 하트 버튼 (시안) — 빈 하트 ↔ 채운 하트, 상태는 useWishlist 그대로
// variant: title = 상세 가격 박스 제목 줄 오른쪽 끝(아이콘 24px, 터치 영역 44px) / overlay = 비교 페이지 카드 썸네일 위 원형
// 카드(링크) 안에서도 쓰므로 클릭이 카드 이동으로 번지지 않게 막는다
export default function HeartButton({ gameId, variant }: { gameId: string; variant: 'title' | 'overlay' }) {
  const { ready, has, toggle } = useWishlist();
  const on = ready && has(gameId);
  return (
    <button
      type="button"
      className={`heart-btn is-${variant}`}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggle(gameId); }}
      aria-label={on ? '찜목록에서 빼기' : '찜목록에 담기'}
      aria-pressed={on}
    >
      <svg width={variant === 'title' ? 24 : 22} height={variant === 'title' ? 24 : 22} viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 2.7 4.5 6.4 4.5c2.1 0 3.9 1.1 5.6 3.1 1.7-2 3.5-3.1 5.6-3.1 3.7 0 5.5 3.9 4 7.3C19.5 16.4 12 21 12 21z" />
      </svg>
    </button>
  );
}
