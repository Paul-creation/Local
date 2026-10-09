import { NextRequest, NextResponse } from 'next/server';
import { SITE_URL } from '../../../../lib/site';
import { isSessionConfigured } from '../../../../lib/user';
import { buildLoginUrl, sanitizeNext } from '../../../../lib/user/steamOpenId';

export const dynamic = 'force-dynamic';

// 스팀 로그인 시작 — 스팀 OpenID 화면으로 보낸다. 돌아올 주소(return_to)는 NEXT_PUBLIC_SITE_URL 기준 /api/auth/steam/callback
// ?next=/돌아갈/경로 (사이트 안 경로만)
export function GET(req: NextRequest) {
  // 세션 비밀 키가 없으면 스팀까지 보내지 않고 바로 돌려보냄 (로그인해도 세션을 못 만들기 때문)
  if (!isSessionConfigured()) return NextResponse.redirect(`${SITE_URL}/?login=unavailable`);
  return NextResponse.redirect(buildLoginUrl(SITE_URL, sanitizeNext(req.nextUrl.searchParams.get('next'))));
}
