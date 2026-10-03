import { NextResponse, type NextRequest } from 'next/server';
import { SITE_URL } from './app/lib/site';

// 운영(Production) 배포를 배포별 주소(…-abc123.vercel.app)로 열면 대표 주소로 보낸다.
// 미리보기(Preview) 배포와 로컬은 그대로 둔다. API는 fetch가 깨지지 않게 matcher에서 제외.
const SITE_HOST = new URL(SITE_URL).host;

export function proxy(req: NextRequest) {
  const host = req.headers.get('host') || '';
  if (process.env.VERCEL_ENV === 'production' && host !== SITE_HOST && host.endsWith('.vercel.app')) {
    return NextResponse.redirect(new URL(req.nextUrl.pathname + req.nextUrl.search, SITE_URL), 308);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api/|_next/|favicon.ico|robots.txt|sitemap.xml|.*\\..*).*)'],
};
