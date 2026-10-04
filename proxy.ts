import { NextResponse, type NextRequest } from 'next/server';
import { SITE_URL } from './app/lib/site';
import { AI_CLIENT_COOKIE, AI_CLIENT_MAX_AGE, newAiClientCookie, verifyAiClientCookie } from './app/lib/aiClient';

// 운영(Production) 배포를 배포별 주소(…-abc123.vercel.app)로 열면 대표 주소로 보낸다.
// 미리보기(Preview) 배포와 로컬은 그대로 둔다. API는 fetch가 깨지지 않게 matcher에서 제외.
const SITE_HOST = new URL(SITE_URL).host;

export function proxy(req: NextRequest) {
  const host = req.headers.get('host') || '';
  if (process.env.VERCEL_ENV === 'production' && host !== SITE_HOST && host.endsWith('.vercel.app')) {
    return NextResponse.redirect(new URL(req.nextUrl.pathname + req.nextUrl.search, SITE_URL), 308);
  }
  // AI 한도용 익명 쿠키가 없거나 위조됐으면 새로 발급. 이번 요청의 서버 렌더링에서도 쓰이게 요청 쿠키에도 넣음
  if (verifyAiClientCookie(req.cookies.get(AI_CLIENT_COOKIE)?.value)) return NextResponse.next();
  const value = newAiClientCookie();
  req.cookies.set(AI_CLIENT_COOKIE, value);
  const res = NextResponse.next({ request: { headers: req.headers } });
  res.cookies.set(AI_CLIENT_COOKIE, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: AI_CLIENT_MAX_AGE,
  });
  return res;
}

export const config = {
  matcher: ['/((?!api/|_next/|favicon.ico|robots.txt|sitemap.xml|.*\\..*).*)'],
};
