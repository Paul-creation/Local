// 사용자 로그인 세션 쿠키 — admin_session(app/lib/adminAuth.ts)과 같은 방식의 HMAC 서명 토큰, 비밀 키만 따로(USER_SESSION_SECRET)
// 쿠키에는 users.id(UUID)만 담는다. 이름·스팀 ID 등은 쿠키에 넣지 않는다.
// DB·서버 전용 import가 없는 순수 함수라 node --test로 바로 시험한다 (user.test.mjs)
import { createHmac, timingSafeEqual } from 'crypto';

export const USER_COOKIE = 'user_session';
export const USER_SESSION_DAYS = 30;
export const USER_SESSION_MAX_AGE = USER_SESSION_DAYS * 24 * 60 * 60; // 초

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// 비밀 키가 없거나 너무 짧으면 로그인을 아예 열지 않는다 (관리자 비밀번호 등으로 대신하지 않음)
const secret = () => {
  const s = process.env.USER_SESSION_SECRET || '';
  return s.length >= 16 ? s : '';
};
export const isSessionConfigured = () => secret() !== '';

// 관리자 토큰과 서로 바꿔 쓸 수 없게 앞에 용도를 붙여 서명
const sign = (payload: string, key: string) => createHmac('sha256', key).update(`user-session:${payload}`).digest('base64url');

// 토큰 = <userId>.<만료(초)>.<서명>
export function createUserSessionToken(userId: string, nowMs = Date.now()): string {
  const key = secret();
  if (!key || !UUID.test(userId)) throw new Error('user session is not configured');
  const payload = `${userId}.${Math.floor(nowMs / 1000) + USER_SESSION_MAX_AGE}`;
  return `${payload}.${sign(payload, key)}`;
}

// 올바른 토큰이면 users.id, 아니면(위조·만료·형식 오류·키 없음) null
export function verifyUserSessionToken(token: string | undefined | null, nowMs = Date.now()): string | null {
  const key = secret();
  if (!key || !token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [userId, exp, sig] = parts;
  if (!UUID.test(userId) || !/^\d{1,12}$/.test(exp) || Number(exp) * 1000 <= nowMs) return null;
  const want = Buffer.from(sign(`${userId}.${exp}`, key));
  const got = Buffer.from(sig);
  return want.length === got.length && timingSafeEqual(want, got) ? userId.toLowerCase() : null;
}

// 쿠키 속성 — 로그인 때와 로그아웃(삭제) 때 같아야 지워진다.
// path는 /api: 서버 컴포넌트가 쿠키를 읽으면 페이지 캐시(revalidate)가 깨지므로, API 요청에만 실리게 한다
export const userCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production', // 로컬 개발(http)에서도 로그인 시험이 되게 admin_session과 같은 규칙
  sameSite: 'lax' as const, // 스팀에서 돌아오는 최상위 이동에는 쿠키가 실려야 하므로 strict 아님
  path: '/api',
};

// 로그인 표시 쿠키 — 헤더·카드가 "로그인했을 때만" /api/me, /api/me/owned를 부르게 하는 힌트. JS가 읽어야 하므로 httpOnly가 아니다.
// 값은 항상 1이고 개인정보가 없다. 이것만으로는 아무 권한이 없다 (진짜 확인은 user_session을 받은 서버가 한다). 만료는 user_session과 같다
export const LOGGED_IN_COOKIE = 'logged_in';
export const loggedInCookieOptions = {
  httpOnly: false,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/', // 페이지(JS)에서 읽어야 해서 user_session(/api)과 달리 사이트 전체
};
