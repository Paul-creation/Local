// 사용자 접근 코드는 전부 여기(app/lib/user/)로 모은다 — 서버 코드가 유일한 방어선이다 (users 표는 브라우저 키로 전면 차단).
//  - 세션 읽기·발급·삭제, users 조회·upsert 는 이 폴더 밖에서 직접 하지 않는다. 라우트는 아래 함수만 부른다.
//  - 응답에는 PUBLIC_USER 칸(id, persona_name, avatar_url)만. steam_id는 밖으로 내보내지 않는다.
import 'server-only';
import { createClient } from '@supabase/supabase-js';
import type { NextRequest, NextResponse } from 'next/server';
import { LOGGED_IN_COOKIE, USER_COOKIE, USER_SESSION_MAX_AGE, createUserSessionToken, loggedInCookieOptions, userCookieOptions, verifyUserSessionToken } from './session';
import { fetchOwnedGames, type OwnedFetch } from './ownedGames';
import type { SteamProfile } from './steamProfile';

export { isSessionConfigured } from './session';

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const PUBLIC_USER = 'id, persona_name, avatar_url';
export type PublicUser = { id: string; persona_name: string | null; avatar_url: string | null };

// 쿠키 → users.id (서명·만료만 확인, DB 조회 없음). 로그인 안 했거나 위조면 null
export function getSessionUserId(req: NextRequest): string | null {
  return verifyUserSessionToken(req.cookies.get(USER_COOKIE)?.value);
}

// 쿠키 → 사용자. 쿠키가 올바른데 users 행이 없으면(탈퇴 등) 로그인 아님으로 본다
export async function getSessionUser(req: NextRequest): Promise<PublicUser | null> {
  const id = getSessionUserId(req);
  if (!id) return null;
  const { data } = await db.from('users').select(PUBLIC_USER).eq('id', id).maybeSingle();
  return (data as PublicUser | null) ?? null;
}

// 스팀 로그인 성공 → users upsert. 프로필(닉네임·아바타)은 가져왔을 때만 갱신하고, 못 가져왔으면 기존 값을 그대로 둔다
export async function upsertSteamUser(steamId: string, profile: SteamProfile | null): Promise<string | null> {
  const row: Record<string, unknown> = { steam_id: steamId, last_login_at: new Date().toISOString() };
  if (profile?.persona_name) row.persona_name = profile.persona_name;
  if (profile?.avatar_url) row.avatar_url = profile.avatar_url;
  const { data, error } = await db.from('users').upsert(row, { onConflict: 'steam_id' }).select('id').single();
  return error || !data ? null : (data as { id: string }).id;
}

// 세션 쿠키(user_session, httpOnly)와 로그인 표시 쿠키(logged_in=1, JS가 읽음)는 항상 같이 설정·삭제한다
export function setSessionCookie(res: NextResponse, userId: string) {
  res.cookies.set(USER_COOKIE, createUserSessionToken(userId), { ...userCookieOptions, maxAge: USER_SESSION_MAX_AGE });
  res.cookies.set(LOGGED_IN_COOKIE, '1', { ...loggedInCookieOptions, maxAge: USER_SESSION_MAX_AGE });
}
export function clearSessionCookie(res: NextResponse) {
  res.cookies.set(USER_COOKIE, '', { ...userCookieOptions, maxAge: 0 });
  res.cookies.set(LOGGED_IN_COOKIE, '', { ...loggedInCookieOptions, maxAge: 0 });
}

// 내 정보 삭제(회원 탈퇴) — 세션의 사용자 한 명만. user_owned_games는 on delete cascade지만 확실히 하려고 먼저 직접 지운다.
// CLAUDE.md 기록 테이블 삭제 금지의 예외: 회원 탈퇴 시 users와 그 하위 표. 둘 중 하나라도 실패하면 false (쿠키도 그대로 둔다)
export async function deleteUserAccount(userId: string): Promise<boolean> {
  const { error: e1 } = await db.from('user_owned_games').delete().eq('user_id', userId);
  if (e1) return false;
  const { error: e2 } = await db.from('users').delete().eq('id', userId);
  return !e2;
}

// 로그인이 아닌 요청(401)에 낡은 세션 쿠키가 실려 있으면 같이 지운다 — 만료·위조·탈퇴로 못 쓰게 된 쿠키를 치워 두기 위해
export function clearStaleSession(req: NextRequest, res: NextResponse) {
  if (req.cookies.get(USER_COOKIE) || req.cookies.get(LOGGED_IN_COOKIE)) clearSessionCookie(res);
}

// 스팀 로그인 응답(response_nonce)을 한 번만 쓰게 기록한다. 이미 있으면 false(재사용 → 로그인 거부).
// DB 오류도 false: 확인할 수 없으면 거부한다. 하루 지난 행은 여기서 같이 지운다 (보안용 임시 표, CLAUDE.md 예외)
export async function consumeNonce(nonce: string): Promise<boolean> {
  if (!nonce || nonce.length > 255) return false;
  await db.from('used_openid_nonces').delete().lt('used_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
  const { error } = await db.from('used_openid_nonces').insert({ nonce });
  return !error;
}

// ── 보유 게임 ──────────────────────────────────────────────
export type OwnedVisibility = 'public' | 'private' | 'unknown';
export type OwnedInfo = { visibility: OwnedVisibility; appids: number[] };
const OWNED_STALE_MS = 24 * 60 * 60 * 1000;
const ERROR_COOLDOWN_MS = 60 * 1000; // 스팀 오류가 나면 이 서버 인스턴스에서는 1분간 다시 부르지 않는다
const lastError = new Map<string, number>();

// 조회 결과를 저장: 공개면 통째 교체(우리 카탈로그에 있는 appid만, 한 트랜잭션), 비공개면 상태만 표시하고 기존 목록은 그대로 둔다, 오류면 아무것도 안 바꾼다
export async function applyOwned(userId: string, fetched: OwnedFetch): Promise<void> {
  if (fetched.kind === 'public') {
    const { error } = await db.rpc('replace_owned_games', { p_user: userId, p_appids: fetched.appids });
    if (error) lastError.set(userId, Date.now());
  } else if (fetched.kind === 'private') {
    await db.from('users').update({ owned_visibility: 'private', owned_synced_at: new Date().toISOString() }).eq('id', userId);
  } else {
    lastError.set(userId, Date.now());
  }
}

// 24시간이 지났거나(force면 무조건) 처음이면 스팀에서 다시 가져와 저장
async function syncOwned(userId: string, steamId: string, syncedAt: string | null, force = false) {
  if (!force) {
    if (syncedAt && Date.now() - Date.parse(syncedAt) < OWNED_STALE_MS) return;
    if (Date.now() - (lastError.get(userId) ?? 0) < ERROR_COOLDOWN_MS) return;
  }
  await applyOwned(userId, await fetchOwnedGames(steamId, process.env.STEAM_API_KEY));
}

// /api/me/owned — 필요하면 갱신한 뒤 {visibility, appids}. 사용자가 없으면 null
export async function getOwned(userId: string): Promise<OwnedInfo | null> {
  const { data: u } = await db.from('users').select('steam_id, owned_synced_at').eq('id', userId).maybeSingle();
  if (!u) return null;
  await syncOwned(userId, u.steam_id as string, u.owned_synced_at as string | null);

  const { data: after } = await db.from('users').select('owned_visibility').eq('id', userId).maybeSingle();
  const appids: number[] = [];
  // 한 번에 1000행까지만 오므로 나눠서 읽는다
  for (let from = 0; ; from += 1000) {
    const { data } = await db.from('user_owned_games').select('steam_appid').eq('user_id', userId).order('steam_appid').range(from, from + 999);
    for (const r of data ?? []) appids.push(r.steam_appid as number);
    if ((data?.length ?? 0) < 1000) break;
  }
  return { visibility: ((after?.owned_visibility as OwnedVisibility) ?? 'unknown'), appids };
}
