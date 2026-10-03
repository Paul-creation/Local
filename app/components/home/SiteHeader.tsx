// 담당: Paul(메인 배너·디자인)
import { SITE_NAME } from '../../lib/site';

// 모든 페이지 공통 상단 바 (layout.tsx).
// 메인의 필터 상태는 처음 열 때 주소에서 읽으므로, 같은 페이지 안 이동도 새로 불러오게 Link 대신 a를 쓴다.
const MENU = [
  { href: '/', label: '홈' },
  { href: '/#free', label: '무료 게임' },
  { href: '/?r=1', label: '비교' },
];

export default function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <a href="/" className="site-logo">{SITE_NAME}</a>
        <nav className="site-menu" aria-label="주요 메뉴">
          {MENU.map((m) => (
            <a key={m.href} href={m.href}>{m.label}</a>
          ))}
        </nav>
      </div>
    </header>
  );
}
