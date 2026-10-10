'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { bumpClientNav } from '../lib/navCount';

// 경로가 바뀔 때마다 클라이언트 이동 횟수를 센다 (BackLink가 사이트 안 이동인지 판정) — 화면에는 아무것도 그리지 않음
// layout에서 {children}보다 앞에 두어, 같은 이동에서 BackLink의 마운트 효과보다 먼저 센다
export default function NavTracker() {
  const pathname = usePathname();
  const last = useRef<string | null>(null);
  useEffect(() => {
    if (last.current !== null && last.current !== pathname) bumpClientNav();
    last.current = pathname;
  }, [pathname]);
  return null;
}
