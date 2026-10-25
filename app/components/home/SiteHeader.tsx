// 담당: Paul(메인 배너·디자인)
import { SITE_NAME } from '../../lib/site';
import AuthMenu from '../AuthMenu';
import NavProgress from '../NavProgress';
import HeaderMenu from './HeaderMenu';
import '../../mono-tokens.css';

// 모든 페이지 공통 상단 바 (layout.tsx). 모바일(768px 미만)에서는 desktopOnly 항목을 숨김 — 로고가 홈 링크, 의견 보내기는 푸터.
// wideOnly("내 PC")는 900px 이상에서만 — 그보다 좁으면 자리가 없어 푸터와 각 화면의 안내 링크로 들어간다.
// narrowHide("커뮤니티")는 350px 이하에서만 숨김 — 로그인 버튼과 겹치지 않게, 푸터에 같은 링크가 있다.
// 메뉴 목록·현재 페이지 표시는 HeaderMenu. 모노 스타일(.site-header.mn)은 globals.css 헤더 구간
// 메인의 필터 상태는 처음 열 때 주소에서 읽으므로, 같은 페이지 안 이동도 새로 불러오게 Link 대신 a를 쓴다.
export default function SiteHeader() {
  return (
    <header className="site-header mn">
      <div className="site-header-inner">
        <a href="/" className="site-logo">{SITE_NAME}</a>
        <HeaderMenu />
        <AuthMenu />
      </div>
      <NavProgress />
    </header>
  );
}
