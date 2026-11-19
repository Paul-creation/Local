import type { Metadata } from 'next';
import { Suspense } from 'react';
import AbResults from '../components/home/ab/AbResults';
import '../brand-tokens.css';
import '../mono-page.css';
import '../mono-lists.css';
import '../components/home/mn/mn.css';

// 조건마다 달라지는 화면(공유 링크 ?n=4&how=coop&g=horror…)이라 검색 결과에는 올리지 않음
export const metadata: Metadata = { title: '친구랑 할 게임 찾기', robots: { index: false } };

export default function FindPage() {
  // useSearchParams를 쓰는 클라이언트 컴포넌트는 Suspense 안에 둔다
  return (
    <main className="page mn mn-inner">
      <Suspense fallback={null}>
        <AbResults />
      </Suspense>
    </main>
  );
}
