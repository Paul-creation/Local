import { NextRequest, NextResponse } from 'next/server';
import { clearSessionCookie } from '../../../lib/user';

export const dynamic = 'force-dynamic';

// 로그아웃 — POST만 받는다 (다른 사이트의 이미지·링크로 몰래 로그아웃시키는 것 방지). Origin이 있으면 우리 주소와 같아야 함
export function POST(req: NextRequest) {
  const origin = req.headers.get('origin');
  if (origin) {
    let host = '';
    try { host = new URL(origin).host; } catch { /* 아래에서 거부 */ }
    if (!host || host !== req.headers.get('host')) return NextResponse.json({ error: '잘못된 요청이에요.' }, { status: 403 });
  }
  // 303으로 '/'에 보낸다 (쿠키 삭제 뒤 로그인 전 메인으로). 주소는 상대 경로라 어느 도메인(프리뷰 포함)에서도 그 도메인의 '/'
  const res = new NextResponse(null, { status: 303, headers: { location: '/', 'cache-control': 'private, no-store' } });
  clearSessionCookie(res);
  return res;
}
