import { NextRequest, NextResponse } from 'next/server';
import { clearStaleSession, getSessionUser } from '../../lib/user';

export const dynamic = 'force-dynamic';

// 로그인 상태 확인 — 헤더가 클라이언트에서 부른다 (페이지 캐시를 깨지 않으려고 서버 렌더링에서는 읽지 않음)
// 사용자별 응답이라 CDN·브라우저에 저장되지 않게 한다
const NO_STORE = { 'cache-control': 'private, no-store' };

export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (user) return NextResponse.json({ id: user.id, persona_name: user.persona_name, avatar_url: user.avatar_url }, { headers: NO_STORE });
  const res = NextResponse.json({ error: '로그인이 필요해요.' }, { status: 401, headers: NO_STORE });
  // 만료·위조·탈퇴로 못 쓰게 된 쿠키가 남아 있으면 치워 둔다
  clearStaleSession(req, res);
  return res;
}
