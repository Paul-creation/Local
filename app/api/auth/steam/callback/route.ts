import { NextRequest, NextResponse } from 'next/server';
import { SITE_URL } from '../../../../lib/site';
import { isSessionConfigured, setSessionCookie, upsertSteamUser } from '../../../../lib/user';
import { verifySteamLogin } from '../../../../lib/user/steamOpenId';
import { fetchSteamProfile } from '../../../../lib/user/steamProfile';

export const dynamic = 'force-dynamic';

const back = (flag: string) => NextResponse.redirect(`${SITE_URL}/?login=${flag}`);

// 스팀에서 돌아오는 곳. 스팀 서버에 되묻기(check_authentication)까지 통과해야만 로그인시킨다.
// 거부 사유는 로그에 짧은 코드로만 남긴다 (스팀 응답 값·키는 남기지 않음)
export async function GET(req: NextRequest) {
  if (!isSessionConfigured()) return back('unavailable');

  const result = await verifySteamLogin(req.nextUrl.searchParams, SITE_URL);
  if (!result.ok) {
    console.warn('[steam-login] 거부:', result.reason);
    return back('failed');
  }

  // 닉네임·아바타는 STEAM_API_KEY가 있을 때만 가져온다 (없거나 실패해도 로그인은 진행)
  const profile = await fetchSteamProfile(result.steamId, process.env.STEAM_API_KEY);
  const userId = await upsertSteamUser(result.steamId, profile);
  if (!userId) return back('failed');

  const res = NextResponse.redirect(`${SITE_URL}${result.next}`);
  setSessionCookie(res, userId);
  return res;
}
