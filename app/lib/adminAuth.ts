import { createHmac, timingSafeEqual } from 'crypto';
import type { NextRequest } from 'next/server';

export const ADMIN_COOKIE = 'admin_session';
export const SESSION_HOURS = 12;

const secret = () => process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD || '';
const sign = (v: string) => createHmac('sha256', secret()).update(v).digest('hex');

export function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function createSessionToken() {
  const exp = String(Date.now() + SESSION_HOURS * 60 * 60 * 1000);
  return `${exp}.${sign(exp)}`;
}

export function isAdmin(req: NextRequest) {
  if (!secret()) return false;
  const token = req.cookies.get(ADMIN_COOKIE)?.value || '';
  const [exp, sig] = token.split('.');
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  return safeEqual(sig, sign(exp));
}
