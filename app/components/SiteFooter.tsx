import Link from 'next/link';
import { SITE_NAME, OPERATOR_NAME } from '../lib/site';
import { FOOTER_GUIDE_LABEL } from '../lib/guideCopy';

// 모든 페이지 하단 공통 푸터 — 사이트 이름·약관 링크·비공식 고지
export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <nav className="site-footer-links" aria-label="사이트 정보">
        <Link href="/">{SITE_NAME}</Link>
        <Link href="/this-week">이번 주 할인 마감</Link>
        <Link href="/guide">{FOOTER_GUIDE_LABEL}</Link>
        <Link href="/my-pc">내 PC</Link>
        <Link href="/community">커뮤니티</Link> {/* 350px 이하에서는 헤더에서 빠짐 */}
        <Link href="/terms">이용약관</Link>
        <Link href="/privacy">개인정보처리방침</Link>
        <Link href="/feedback">의견 보내기</Link>
      </nav>
      <p>{SITE_NAME}는 Valve 및 각 게임사와 관련 없는 비공식 사이트입니다. Steam은 Valve Corporation의 상표이며, 게임 이미지와 데이터의 권리는 각 권리자에게 있습니다.</p>
      <p>일부 소개 문구는 AI로 작성되었습니다.</p>
      <p className="site-footer-copy">© 2026 {OPERATOR_NAME}. All rights reserved.</p>
    </footer>
  );
}
