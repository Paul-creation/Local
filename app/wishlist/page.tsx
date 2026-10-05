import type { Metadata } from 'next';
import { Suspense } from 'react';
import WishlistView from '../components/wishlist/WishlistView';

// 내 브라우저에 저장된 목록이거나 공유 주소(?ids=)마다 달라지는 화면이라 검색 결과에는 올리지 않음
export const metadata: Metadata = { title: '찜목록', robots: { index: false } };

export default function WishlistPage() {
  // useSearchParams를 쓰는 클라이언트 컴포넌트는 Suspense 안에 둔다
  return (
    <main className="page">
      <Suspense fallback={null}>
        <WishlistView />
      </Suspense>
    </main>
  );
}
