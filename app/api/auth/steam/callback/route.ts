import { NextRequest, NextResponse } from 'next/server';
import { SITE_URL } from '../../../../lib/site';
import { applyOwned, consumeNonce, isSessionConfigured, setSessionCookie, upsertSteamUser } from '../../../../lib/user';
import { fetchOwnedGames } from '../../../../lib/user/ownedGames';
import { verifySteamLogin } from '../../../../lib/user/steamOpenId';
import { fetchSteamProfile } from '../../../../lib/user/steamProfile';

export const dynamic = 'force-dynamic';
export const maxDuration = 20; // 스팀 확인 + 프로필 + 보유 게임 조회가 겹쳐도 끊기지 않게

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

  // 같은 응답을 두 번 쓰는 것(재사용) 차단 — 스팀 검증을 통과한 응답만 기록한다
  if (!(await consumeNonce(result.nonce))) {
    console.warn('[steam-login] 거부: nonce_reused');
    return back('failed');
  }

  // 닉네임·아바타·보유 게임은 STEAM_API_KEY가 있을 때만 가져온다 (없거나 실패해도 로그인은 진행). 둘은 서로 기다릴 필요가 없어 동시에 부른다
  const apiKey = process.env.STEAM_API_KEY;
  const [profile, owned] = await Promise.all([fetchSteamProfile(result.steamId, apiKey), fetchOwnedGames(result.steamId, apiKey)]);
  const userId = await upsertSteamUser(result.steamId, profile);
  if (!userId) return back('failed');
  await applyOwned(userId, owned).catch(() => {}); // 로그인 때는 24시간 기준 없이 새로 가져온 값을 저장

  const res = NextResponse.redirect(`${SITE_URL}${result.next}`);
  setSessionCookie(res, userId);
  return res;
}
