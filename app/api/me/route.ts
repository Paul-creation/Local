import { NextRequest, NextResponse } from 'next/server';
import { clearSessionCookie, clearStaleSession, deleteUserAccount, getSessionUser, getSessionUserId } from '../../lib/user';
import { isSameOriginRequest } from '../../lib/user/session';

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

// 내 정보 삭제 — 세션 쿠키의 사용자 본인만 지울 수 있다 (id를 요청에서 받지 않음). 지운 뒤 세션·로그인 표시 쿠키도 같이 지운다
export async function DELETE(req: NextRequest) {
  if (!isSameOriginRequest(req.headers.get('origin'), req.headers.get('host'))) {
    return NextResponse.json({ error: '잘못된 요청이에요.' }, { status: 403, headers: NO_STORE });
  }
  const id = getSessionUserId(req);
  if (!id) return NextResponse.json({ error: '로그인이 필요해요.' }, { status: 401, headers: NO_STORE });
  if (!(await deleteUserAccount(id))) {
    return NextResponse.json({ error: '삭제하지 못했어요. 잠시 뒤 다시 시도해 주세요.' }, { status: 500, headers: NO_STORE });
  }
  const res = NextResponse.json({ ok: true }, { headers: NO_STORE });
  clearSessionCookie(res);
  return res;
}
