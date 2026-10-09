import { NextRequest, NextResponse } from 'next/server';
import { clearStaleSession, getOwned, getSessionUserId } from '../../../lib/user';

export const dynamic = 'force-dynamic';
export const maxDuration = 20;

// 내 보유 게임 — 우리 카탈로그에 있는 게임의 스팀 appid만. 마지막 동기화가 24시간보다 오래됐으면 스팀에서 다시 가져온다
// visibility: public(목록 정상) / private(스팀 프로필의 게임 세부 정보가 비공개 — 예전에 가져온 목록이 있으면 그대로 줌) / unknown(아직 못 가져옴)
const NO_STORE = { 'cache-control': 'private, no-store' };

export async function GET(req: NextRequest) {
  const userId = getSessionUserId(req);
  const owned = userId ? await getOwned(userId) : null;
  if (owned) return NextResponse.json(owned, { headers: NO_STORE });
  const res = NextResponse.json({ error: '로그인이 필요해요.' }, { status: 401, headers: NO_STORE });
  clearStaleSession(req, res);
  return res;
}
