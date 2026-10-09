import type { Metadata } from 'next';
import { Suspense } from 'react';
import MyPcView from '../components/pcspec/MyPcView';

// 내 브라우저에만 저장되는 사양 화면이라 검색 결과에는 올리지 않음 (사이트맵에도 없음)
export const metadata: Metadata = { title: '내 PC', robots: { index: false } };

export default function MyPcPage() {
  // useSearchParams를 쓰는 클라이언트 컴포넌트는 Suspense 안에 둔다
  return (
    <main className="page">
      <Suspense fallback={null}>
        <MyPcView />
      </Suspense>
    </main>
  );
}
