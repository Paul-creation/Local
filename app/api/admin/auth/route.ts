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
    path: '/api/admin',
    maxAge: SESSION_HOURS * 60 * 60,
  });
  return res;
}
