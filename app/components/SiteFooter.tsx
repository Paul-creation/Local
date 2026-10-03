import Link from 'next/link';
import { SITE_NAME, OPERATOR_NAME, CONTACT_EMAIL, CONTACT_TEXT } from '../lib/site';

// 모든 페이지 하단 공통 푸터 — 법적 고지·약관 링크·연락처
export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <nav className="site-footer-links" aria-label="사이트 정보">
        <Link href="/privacy"><strong>개인정보처리방침</strong></Link>
        <Link href="/terms">이용약관</Link>
        <Link href="/community/policy">커뮤니티 운영정책</Link>
        <Link href="/feedback">의견 보내기</Link>
        <span>
          연락처:{' '}
          {CONTACT_EMAIL ? <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> : CONTACT_TEXT}
        </span>
      </nav>
      <p>Valve 및 각 게임사와 무관한 비공식 사이트이며, 게임 이미지·상표·영상의 권리는 각 권리자에게 있습니다.</p>
      <p>가격·할인 정보는 실제와 다를 수 있습니다. 구매 전 각 스토어에서 확인해주세요.</p>
      <p>일부 소개 문구는 AI로 작성되었습니다.</p>
      <p className="site-footer-copy">{SITE_NAME} · © 2026 {OPERATOR_NAME}</p>
    </footer>
  );
}
