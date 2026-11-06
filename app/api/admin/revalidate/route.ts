import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { timingSafeEqual } from 'crypto';

// 관리자용 캐시 갱신 — x-admin-key 헤더가 ADMIN_REVALIDATE_KEY와 같을 때만
// 전체 게임 목록(gameIndex)은 /api/games/list 응답 캐시 하나뿐이라 그 경로를 무효화하면 둘 다 새로 만들어진다
// 환경변수가 비어 있으면 항상 401
export const dynamic = 'force-dynamic';

function keyOk(req: NextRequest) {
  const expected = process.env.ADMIN_REVALIDATE_KEY || '';
  const given = req.headers.get('x-admin-key') || '';
  if (!expected || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  if (!keyOk(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  revalidatePath('/api/games/list');
  return NextResponse.json({ ok: true, revalidated: ['/api/games/list'] });
}

export async function GET() {
  return NextResponse.json({ error: 'method not allowed' }, { status: 405, headers: { Allow: 'POST' } });
}
