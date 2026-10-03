import type { Metadata } from "next";
import "pretendard/dist/web/static/pretendard.css";
import "./globals.css";
import { SITE_NAME, SITE_URL, SITE_DESCRIPTION, BASE_OG } from "./lib/site";
import SiteHeader from "./components/home/SiteHeader";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${SITE_NAME} — 친구랑 할 게임 찾기`, template: `%s | ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  // url·canonical은 페이지마다 따로 (여기 두면 모든 하위 페이지가 메인 주소를 가리키게 됨)
  openGraph: { ...BASE_OG, title: SITE_NAME, description: SITE_DESCRIPTION },
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
    <html lang="ko">
      <body>
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}