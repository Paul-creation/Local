// AI 한도용 브라우저별 익명 ID — 서버가 발급하고 서명한 httpOnly 쿠키 (개인 식별 정보 없음, 무작위 값)
// proxy.ts가 페이지 요청 때 없으면 발급하고, aiGuard.ts가 서명을 확인해 한도를 셀 때 씀
import { createHmac, randomUUID, timingSafeEqual } from 'crypto';

export const AI_CLIENT_COOKIE = 'ai_cid';
export const AI_CLIENT_MAX_AGE = 60 * 60 * 24 * 365;

const sign = (id: string) =>
  createHmac('sha256', 'ai-client:' + (process.env.SUPABASE_SERVICE_ROLE_KEY || '')).update(id).digest('base64url').slice(0, 32);

export const newAiClientCookie = () => {
  const id = randomUUID();
  return `${id}.${sign(id)}`;
};

// 서명이 맞으면 ID를, 없거나 위조됐으면 null
export function verifyAiClientCookie(value: string | undefined | null): string | null {
  const [id, sig] = (value || '').split('.');
  if (!id || !sig) return null;
  const a = Buffer.from(sig);
  const b = Buffer.from(sign(id));
  return a.length === b.length && timingSafeEqual(a, b) ? id : null;
}

export function readAiClientId(h: Headers): string | null {
  const raw = (h.get('cookie') || '').split(';').map((c) => c.trim()).find((c) => c.startsWith(AI_CLIENT_COOKIE + '='));
  return verifyAiClientCookie(raw ? decodeURIComponent(raw.slice(AI_CLIENT_COOKIE.length + 1)) : null);
}
