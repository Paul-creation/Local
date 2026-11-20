'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ComponentProps, FocusEvent, MouseEvent, TouchEvent } from 'react';

// 게임 상세(/games/[id])로 가는 카드 링크 — 화면에 보이는 것만으로는 미리 받지 않고(prefetch={false}), 마우스를 올리거나 포커스·터치했을 때 한 번만 router.prefetch
// 같은 주소는 한 번만 부른다 (탭 안에서 공유)
const prefetched = new Set<string>();

type Props = Omit<ComponentProps<typeof Link>, 'prefetch'>;

export default function GameLink({ onMouseEnter, onFocus, onTouchStart, ...rest }: Props) {
  const router = useRouter();
  const warm = () => {
    const href = typeof rest.href === 'string' ? rest.href : rest.href.pathname;
    if (!href || prefetched.has(href)) return;
    prefetched.add(href);
    try { router.prefetch(href); } catch { /* 실패해도 클릭하면 그대로 이동 */ }
  };
  return (
    <Link
      {...rest}
      prefetch={false}
      onMouseEnter={(e: MouseEvent<HTMLAnchorElement>) => { warm(); onMouseEnter?.(e); }}
      onFocus={(e: FocusEvent<HTMLAnchorElement>) => { warm(); onFocus?.(e); }}
      onTouchStart={(e: TouchEvent<HTMLAnchorElement>) => { warm(); onTouchStart?.(e); }}
    />
  );
}
