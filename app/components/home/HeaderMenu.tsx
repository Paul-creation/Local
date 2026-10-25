'use client';

import { usePathname } from 'next/navigation';
import CompareCount from '../CompareCount';

const MENU = [
  { href: '/', label: '홈', desktopOnly: true },
  { href: '/compare', label: '비교' },
  { href: '/my-pc', label: '내 PC', wideOnly: true },
  { href: '/wishlist', label: '찜목록' },
  { href: '/community', label: '커뮤니티', narrowHide: true },
  { href: '/feedback', label: '의견 보내기', desktopOnly: true }, // 모바일에서는 푸터 링크로
];

// 현재 페이지 메뉴에 aria-current="page" (홈은 / 일 때만, 나머지는 그 경로 아래 모든 주소)
export default function HeaderMenu() {
  const path = usePathname();
  return (
    <nav className="site-menu" aria-label="주요 메뉴">
      {MENU.map((m) => (
        <a key={m.href} href={m.href} aria-current={(m.href === '/' ? path === '/' : path === m.href || path.startsWith(`${m.href}/`)) ? 'page' : undefined} className={m.desktopOnly ? 'is-desktop-only' : m.wideOnly ? 'is-wide-only' : m.narrowHide ? 'is-narrow-hide' : undefined}>{m.label}{m.href === '/compare' && <CompareCount />}</a>
      ))}
    </nav>
  );
}
