// 헤더 메뉴 목록 — 데스크톱 가로 메뉴(HeaderMenu)와 모바일 드로어(MobileNav)가 같이 쓴다
export type MenuItem = { href: string; label: string; desktopOnly?: boolean; wideOnly?: boolean; narrowHide?: boolean };

export const MENU: MenuItem[] = [
  { href: '/', label: '홈', desktopOnly: true },
  { href: '/compare', label: '비교' },
  { href: '/my-pc', label: '내 PC', wideOnly: true },
  { href: '/wishlist', label: '찜목록' },
  { href: '/community', label: '커뮤니티' },
  { href: '/feedback', label: '의견 보내기', desktopOnly: true },
];

// 현재 페이지 판정 (홈은 / 일 때만, 나머지는 그 경로 아래 모든 주소)
export const isCurrent = (href: string, path: string) => (href === '/' ? path === '/' : path === href || path.startsWith(`${href}/`));
