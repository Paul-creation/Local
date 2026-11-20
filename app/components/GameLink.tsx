'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import type { ComponentProps, FocusEvent, MouseEvent, TouchEvent } from 'react';

// 게임 상세(/games/[id])로 가는 카드 링크 — 화면에 보이는 것만으로는 미리 받지 않고(prefetch={false}), 마우스를 올리거나 포커스·터치했을 때 한 번만 router.prefetch
// 같은 주소는 한 번만 부른다 (탭 안에서 공유)
const prefetched = new Set<string>();

// 같은 주소는 한 번만 prefetch — 링크 말고 키보드 선택처럼 다른 곳에서도 이 함수를 쓴다
export function prefetchOnce(router: Pick<AppRouterInstance, 'prefetch'>, href: string) {
  if (!href || prefetched.has(href)) return;
  prefetched.add(href);
  try { router.prefetch(href); } catch { /* 실패해도 클릭하면 그대로 이동 */ }
}

type Props = Omit<ComponentProps<typeof Link>, 'prefetch'>;

export default function GameLink({ onMouseEnter, onFocus, onTouchStart, ...rest }: Props) {
  const router = useRouter();
  const warm = () => prefetchOnce(router, typeof rest.href === 'string' ? rest.href : (rest.href.pathname ?? ''));
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
