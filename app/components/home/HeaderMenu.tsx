'use client';

import { usePathname } from 'next/navigation';
import CompareCount from '../CompareCount';
import { MENU, isCurrent } from './menuItems';

// 현재 페이지 메뉴에 aria-current="page" (홈은 / 일 때만, 나머지는 그 경로 아래 모든 주소)
export default function HeaderMenu() {
  const path = usePathname();
  return (
    <nav className="site-menu" aria-label="주요 메뉴">
      {MENU.map((m) => (
        <a key={m.href} href={m.href} aria-current={isCurrent(m.href, path) ? 'page' : undefined} className={m.desktopOnly ? 'is-desktop-only' : m.wideOnly ? 'is-wide-only' : undefined}>{m.label}{m.href === '/compare' && <CompareCount />}</a>
      ))}
    </nav>
  );
}
