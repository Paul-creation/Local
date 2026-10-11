import { NextRequest, NextResponse } from 'next/server';
import { SITE_URL } from '../../../../lib/site';
import { consumeNonce, isSessionConfigured, setSessionCookie, upsertSteamUser } from '../../../../lib/user';
import { verifySteamLogin } from '../../../../lib/user/steamOpenId';
import { fetchSteamProfile } from '../../../../lib/user/steamProfile';

export const dynamic = 'force-dynamic';
export const maxDuration = 20; // 스팀 확인 + 프로필 조회가 겹쳐도 끊기지 않게

// 스팀 화면은 이 응답이 올 때까지 멈춰 있어 사용자가 다시 누르기 쉽다 — 그래서 여기서는 로그인에 꼭 필요한 일만 한다.
// 보유 게임 조회·저장은 하지 않는다 (/api/me/owned가 24시간 규칙으로 처리. 비공개·미확인이면 upsertSteamUser가 동기화 시각을 비워 바로 다시 가져오게 한다)
// 결과는 로그에 짧은 코드와 소요 시간(ms)만 남긴다 (Steam ID·nonce·쿠키·스팀 응답 값은 남기지 않음)
export async function GET(req: NextRequest) {
  const t0 = Date.now();
  const done = (code: string, res: NextResponse) => {
    console.info('[steam-callback]', code, Date.now() - t0);
    return res;
  };
  const back = (flag: string, code: string) => done(code, NextResponse.redirect(`${SITE_URL}/?login=${flag}`));

  if (!isSessionConfigured()) return back('unavailable', 'unconfigured');

  const result = await verifySteamLogin(req.nextUrl.searchParams, SITE_URL);
  if (!result.ok) {
    console.warn('[steam-login] 거부:', result.reason);
    return back('failed', result.reason);
  }

  // 닉네임·아바타는 STEAM_API_KEY가 있을 때만 (없거나 실패해도 로그인은 진행). 스팀 검증을 통과한 뒤에만 부르고, nonce 기록과 동시에 보낸다
  const profilePromise = fetchSteamProfile(result.steamId, process.env.STEAM_API_KEY);
  // 같은 응답을 두 번 쓰는 것(재사용) 차단 — 스팀 검증을 통과한 응답만 기록한다
  if (!(await consumeNonce(result.nonce))) {
    console.warn('[steam-login] 거부: nonce_reused');
    return back('failed', 'nonce_reused');
  }

  const userId = await upsertSteamUser(result.steamId, await profilePromise);
  if (!userId) return back('failed', 'user_save_failed');

  const res = NextResponse.redirect(`${SITE_URL}${result.next}`);
  setSessionCookie(res, userId);
  return done('ok', res);
}
