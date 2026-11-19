// 담당: Paul(메인 배너·디자인)
import AuthMenu from '../AuthMenu';
import NavProgress from '../NavProgress';
import Wordmark from '../brand/Wordmark';
import HeaderMenu from './HeaderMenu';
import MobileNav from './MobileNav';
import '../../brand-tokens.css';

// 모든 페이지 공통 상단 바 (layout.tsx). 모바일(767px 이하)에서는 메뉴 링크·로그인 버튼을 숨기고 오른쪽 햄버거(MobileNav) 드로어에 모두 넣는다.
// wideOnly("내 PC")는 900px 이상에서만 — 768~899px에서는 자리가 없어 푸터와 각 화면의 안내 링크로 들어간다.
// 메뉴 목록·현재 페이지 표시는 HeaderMenu. 헤더 모양(.site-header.mn)은 globals.css 헤더 구간 — 메인(.mn-hero가 있을 때)에서는 히어로 위에 투명
// 메인의 필터 상태는 처음 열 때 주소에서 읽으므로, 같은 페이지 안 이동도 새로 불러오게 Link 대신 a를 쓴다.
export default function SiteHeader() {
  return (
    <header className="site-header mn">
      <div className="site-header-inner">
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- 메인 필터 상태를 주소에서 새로 읽게 a */}
        <a href="/" className="site-logo"><Wordmark priority /></a>
        <HeaderMenu />
        <AuthMenu />
        <MobileNav />
      </div>
      <NavProgress />
    </header>
  );
}
