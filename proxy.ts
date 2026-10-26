import { NextResponse, type NextRequest } from 'next/server';
import { SITE_URL } from './app/lib/site';
import { ADMIN_COOKIE, isAdminToken } from './app/lib/adminAuth';
import { AI_CLIENT_COOKIE, AI_CLIENT_MAX_AGE, newAiClientCookie, verifyAiClientCookie } from './app/lib/aiClient';

// 운영(Production) 배포를 배포별 주소(…-abc123.vercel.app)로 열면 대표 주소로 보낸다.
// 미리보기(Preview) 배포와 로컬은 그대로 둔다. API는 fetch가 깨지지 않게 matcher에서 제외.
const SITE_HOST = new URL(SITE_URL).host;

export function proxy(req: NextRequest) {
  const host = req.headers.get('host') || '';
  if (process.env.VERCEL_ENV === 'production' && host !== SITE_HOST && host.endsWith('.vercel.app')) {
    return NextResponse.redirect(new URL(req.nextUrl.pathname + req.nextUrl.search, SITE_URL), 308);
  }
  // 관리자만: /c/[handle]?preview=1 → 동의 전 큐레이터 비공개 미리보기(/c-preview/[handle], 거기서도 관리자 쿠키를 다시 확인). 관리자가 아니면 그냥 공개 페이지로 간다
  // 안 보일 때 원인을 응답 헤더(x-curator-preview)로 가려낼 수 있게 한다: rewritten | no-cookie | bad-cookie
  const preview = req.nextUrl.pathname.match(/^\/c\/([^/]+)\/?$/);
  let previewState: string | null = null;
  if (preview && req.nextUrl.searchParams.get('preview') === '1') {
    const token = req.cookies.get(ADMIN_COOKIE)?.value || '';
    if (isAdminToken(token)) {
      const url = req.nextUrl.clone();
      url.pathname = `/c-preview/${preview[1]}`;
      url.search = '';
      const res = NextResponse.rewrite(url);
      res.headers.set('x-curator-preview', 'rewritten');
      return res;
    }
    previewState = token ? 'bad-cookie' : 'no-cookie';
  }
  // AI 한도용 익명 쿠키가 없거나 위조됐으면 새로 발급. 이번 요청의 서버 렌더링에서도 쓰이게 요청 쿠키에도 넣음
  const withNote = (res: NextResponse) => {
    if (previewState) res.headers.set('x-curator-preview', previewState);
    return res;
  };
  if (verifyAiClientCookie(req.cookies.get(AI_CLIENT_COOKIE)?.value)) return withNote(NextResponse.next());
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
  return withNote(res);
}

export const config = {
  // 점이 든 주소는 아래 첫 항목에서 빠지므로(정적 파일 제외용), 점이 든 핸들(gamelog.archive 등)의 /c/<handle>은 따로 넣는다
  matcher: ['/((?!api/|_next/|favicon.ico|robots.txt|sitemap.xml|.*\\..*).*)', '/c/:handle'],
};
