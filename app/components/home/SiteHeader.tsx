// 담당: Paul(메인 배너·디자인)
import { SITE_NAME } from '../../lib/site';
import ThemeToggle from '../ThemeToggle';
import AuthMenu from '../AuthMenu';
import CompareCount from '../CompareCount';
import NavProgress from '../NavProgress';

// 모든 페이지 공통 상단 바 (layout.tsx). 모바일(768px 미만)에서는 desktopOnly 항목을 숨김 — 로고가 홈 링크, 의견 보내기는 푸터.
// 메인의 필터 상태는 처음 열 때 주소에서 읽으므로, 같은 페이지 안 이동도 새로 불러오게 Link 대신 a를 쓴다.
const MENU = [
  { href: '/', label: '홈', desktopOnly: true },
  { href: '/compare', label: '비교' },
  { href: '/wishlist', label: '찜목록' },
  { href: '/community', label: '커뮤니티' },
  { href: '/feedback', label: '의견 보내기', desktopOnly: true }, // 모바일에서는 푸터 링크로
];

export default function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <a href="/" className="site-logo">{SITE_NAME}</a>
        <nav className="site-menu" aria-label="주요 메뉴">
          {MENU.map((m) => (
            <a key={m.href} href={m.href} className={m.desktopOnly ? 'is-desktop-only' : undefined}>{m.label}{m.href === '/compare' && <CompareCount />}</a>
          ))}
        </nav>
        <ThemeToggle />
        <AuthMenu />
      </div>
      <NavProgress />
    </header>
  );
}
