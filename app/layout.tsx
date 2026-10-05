import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import "pretendard/dist/web/static/pretendard-dynamic-subset.css";
import "./globals.css";
import { SITE_NAME, SITE_URL, SITE_TITLE, SITE_META_DESCRIPTION, BASE_OG } from "./lib/site";
import SiteHeader from "./components/home/SiteHeader";
import SiteFooter from "./components/SiteFooter";
import CompareTray from "./components/CompareTray";
import { THEME_SCRIPT } from "./lib/theme";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: SITE_TITLE, template: `%s | ${SITE_NAME}` },
  description: SITE_META_DESCRIPTION,
  // url·canonical은 페이지마다 따로 (여기 두면 모든 하위 페이지가 메인 주소를 가리키게 됨)
  openGraph: { ...BASE_OG, title: SITE_TITLE, description: SITE_META_DESCRIPTION },
  twitter: { card: 'summary_large_image' },
  // 구글·네이버 소유 확인 코드 (Vercel 환경변수에 넣으면 자동 적용)
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_VERIFICATION || undefined,
    other: process.env.NEXT_PUBLIC_NAVER_VERIFICATION
      ? { 'naver-site-verification': process.env.NEXT_PUBLIC_NAVER_VERIFICATION }
      : undefined,
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    // 다크가 기본. 라이트를 고른 사람은 첫 HTML 스크립트가 data-theme="light"를 붙임 → html 속성이 서버와 달라도 경고 안 냄
    <html lang="ko" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <SiteHeader />
        {children}
        <SiteFooter />
        <CompareTray />
        {/* Vercel 방문 통계 — 쿠키 없이 페이지 조회 수만 셈 (Vercel 대시보드에서 Analytics를 켜야 수집됨) */}
        <Analytics />
      </body>
    </html>
  );
}