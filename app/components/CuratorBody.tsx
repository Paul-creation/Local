'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import CuratorGames, { type Tab } from './CuratorGames';

type Props = Omit<React.ComponentProps<typeof CuratorGames>, 'tab' | 'filterParam' | 'sortParam'>;

// 탭은 ?view=single|collection (기본 single). 예전 주소 호환: ?view=all → single, ?post=<게시물 주소>는 그 게시물이 속한 탭
// 주소는 읽는 쪽(클라이언트)에서만 본다 — 서버 페이지가 searchParams를 읽으면 ISR이 꺼진다
function tabOf(view: string | null, post: string | null, sections: Props['sections']): Tab {
  if (view === 'single' || view === 'collection') return view;
  const hit = post ? sections.find((s) => s.key === post) : null;
  return hit ? hit.postType : 'single';
}

function Inner(props: Props) {
  const sp = useSearchParams();
  return <CuratorGames {...props} tab={tabOf(sp.get('view'), sp.get('post'), props.sections)} filterParam={sp.get('f') ?? ''} sortParam={sp.get('s') ?? ''} />;
}

export default function CuratorBody(props: Props) {
  return (
    <Suspense fallback={<CuratorGames {...props} tab="single" filterParam="" sortParam="" />}>
      <Inner {...props} />
    </Suspense>
  );
}
