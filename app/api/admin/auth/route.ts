import { NextRequest, NextResponse } from 'next/server';
import { ADMIN_COOKIE, SESSION_HOURS, createSessionToken, safeEqual } from '../../../lib/adminAuth';

export async function POST(req: NextRequest) {
  const { password } = await req.json().catch(() => ({ password: '' }));
  const expected = process.env.ADMIN_PASSWORD || '';

  if (!expected || typeof password !== 'string' || !safeEqual(password, expected)) {
    await new Promise((r) => setTimeout(r, 1000));
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, createSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/', // 커뮤니티 글쓰기 API(운영자 배지)와 큐레이터 비공개 미리보기(/c/[handle]?preview=1)가 관리자 여부를 알아야 해서 사이트 전체. 이전 로그인의 /api 쿠키는 최대 12시간 뒤 사라짐
    maxAge: SESSION_HOURS * 60 * 60,
  });
  return res;
}
