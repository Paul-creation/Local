import type { Metadata } from "next";
import "pretendard/dist/web/static/pretendard.css";
import "./globals.css";
import { SITE_NAME, SITE_URL, SITE_DESCRIPTION } from "./lib/site";
import SiteHeader from "./components/home/SiteHeader";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${SITE_NAME} — 친구랑 할 게임 찾기`, template: `%s | ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  openGraph: { siteName: SITE_NAME, locale: 'ko_KR', type: 'website', title: SITE_NAME, description: SITE_DESCRIPTION, url: '/' },
  twitter: { card: 'summary_large_image' },
  alternates: { canonical: '/' },
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
    <html lang="ko">
      <body>
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}