// 사용자 접근 코드는 전부 여기(app/lib/user/)로 모은다 — 서버 코드가 유일한 방어선이다 (users 표는 브라우저 키로 전면 차단).
//  - 세션 읽기·발급·삭제, users 조회·upsert 는 이 폴더 밖에서 직접 하지 않는다. 라우트는 아래 함수만 부른다.
//  - 응답에는 PUBLIC_USER 칸(id, persona_name, avatar_url)만. steam_id는 밖으로 내보내지 않는다.
import 'server-only';
import { createClient } from '@supabase/supabase-js';
import type { NextRequest, NextResponse } from 'next/server';
import { USER_COOKIE, USER_SESSION_MAX_AGE, createUserSessionToken, userCookieOptions, verifyUserSessionToken } from './session';
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

export function setSessionCookie(res: NextResponse, userId: string) {
  res.cookies.set(USER_COOKIE, createUserSessionToken(userId), { ...userCookieOptions, maxAge: USER_SESSION_MAX_AGE });
}
export function clearSessionCookie(res: NextResponse) {
  res.cookies.set(USER_COOKIE, '', { ...userCookieOptions, maxAge: 0 });
}
