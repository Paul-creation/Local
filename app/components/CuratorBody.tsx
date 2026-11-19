'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import CuratorGames from './CuratorGames';

type Props = Omit<React.ComponentProps<typeof CuratorGames>, 'view' | 'postKey' | 'filterParam' | 'sortParam'>;

// ?view=all(게임 전체)·?post=<게시물 주소>(게시물 상세)는 읽는 쪽(클라이언트)에서만 본다 — 서버 페이지가 searchParams를 읽으면 ISR이 꺼진다
function Inner(props: Props) {
  const sp = useSearchParams();
  return <CuratorGames {...props} view={sp.get('view') === 'all' ? 'all' : 'posts'} postKey={sp.get('post')} filterParam={sp.get('f') ?? ''} sortParam={sp.get('s') ?? ''} />;
}

export default function CuratorBody(props: Props) {
  return (
    <Suspense fallback={<CuratorGames {...props} view="posts" postKey={null} filterParam="" sortParam="" />}>
      <Inner {...props} />
    </Suspense>
  );
}
