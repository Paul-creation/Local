'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import CuratorGames from './CuratorGames';

type Props = Omit<React.ComponentProps<typeof CuratorGames>, 'initialView'>;

// ?view=all은 읽는 쪽(클라이언트)에서만 본다 — 서버 페이지가 searchParams를 읽으면 ISR이 꺼진다
function Inner(props: Props) {
  const view = useSearchParams().get('view') === 'all' ? 'all' : 'posts';
  return <CuratorGames {...props} initialView={view} />;
}

export default function CuratorBody(props: Props) {
  return (
    <Suspense fallback={<CuratorGames {...props} />}>
      <Inner {...props} />
    </Suspense>
  );
}
