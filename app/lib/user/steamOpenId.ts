// 스팀 OpenID 2.0 로그인 — 시작 주소 만들기와 돌아온 응답 검증 (순수 함수 + fetch, DB 접근 없음)
// 검증은 (1) 우리가 먼저 모양·출처를 확인하고 (2) 스팀 서버에 openid.mode=check_authentication으로 되물어 is_valid:true일 때만 통과한다.
// 하나라도 어긋나면 전부 로그인 거부. 응답에서 신뢰하는 값은 스팀이 서명한(openid.signed) 것뿐이다.
export const STEAM_OPENID_ENDPOINT = 'https://steamcommunity.com/openid/login';
export const CALLBACK_PATH = '/api/auth/steam/callback';
const OPENID_NS = 'http://specs.openid.net/auth/2.0';
const CLAIMED_ID = /^https:\/\/steamcommunity\.com\/openid\/id\/(\d{17})$/;
// 이 값들이 스팀의 서명 대상에 들어 있지 않으면, 서명이 맞아도 바꿔치기된 값일 수 있어 거부
const REQUIRED_SIGNED = ['op_endpoint', 'claimed_id', 'identity', 'return_to', 'response_nonce', 'assoc_handle'];
const NONCE_MAX_AGE_MS = 10 * 60 * 1000;

// 로그인 뒤 돌아갈 곳 — 사이트 안 경로만 허용 ("//evil.com", "/\evil.com", 로그인 API 자신 등은 홈으로)
export function sanitizeNext(v: string | null | undefined): string {
  if (!v || v.length > 300 || !/^\/(?![/\\])[^\s\\]*$/.test(v) || v.startsWith('/api/')) return '/';
  return v;
}

export function buildLoginUrl(siteUrl: string, next: string): string {
  const base = siteUrl.replace(/\/$/, '');
  const q = new URLSearchParams({
    'openid.ns': OPENID_NS,
    'openid.mode': 'checkid_setup',
    'openid.return_to': `${base}${CALLBACK_PATH}?next=${encodeURIComponent(sanitizeNext(next))}`,
    'openid.realm': base,
    'openid.identity': 'http://specs.openid.net/auth/2.0/identifier_select',
    'openid.claimed_id': 'http://specs.openid.net/auth/2.0/identifier_select',
  });
  return `${STEAM_OPENID_ENDPOINT}?${q.toString()}`;
}

export type SteamLoginResult = { ok: true; steamId: string; next: string } | { ok: false; reason: string };
const reject = (reason: string): SteamLoginResult => ({ ok: false, reason });

// 스팀이 돌려준 openid.* 값을 우리 쪽에서 먼저 확인 (네트워크 없음)
export function checkAssertion(query: URLSearchParams, siteUrl: string, nowMs = Date.now()): SteamLoginResult {
  const p: Record<string, string> = Object.create(null);
  for (const [k, v] of query) {
    if (!k.startsWith('openid.')) continue;
    const name = k.slice(7);
    if (name in p || k.length > 80 || v.length > 2000) return reject('duplicate_or_long_param'); // 같은 값이 두 번 오면 어느 쪽을 믿을지 모호하므로 거부
    p[name] = v;
  }
  if (p.ns !== OPENID_NS) return reject('bad_ns');
  if (p.mode !== 'id_res') return reject('bad_mode'); // cancel·error 등
  if (p.op_endpoint !== STEAM_OPENID_ENDPOINT) return reject('bad_op_endpoint');
  const m = CLAIMED_ID.exec(p.claimed_id || '');
  if (!m || p.identity !== p.claimed_id) return reject('bad_claimed_id');
  if (!p.sig || !p.assoc_handle) return reject('missing_sig');

  // return_to가 우리 로그인 콜백인지. 돌아갈 곳(next)은 스팀이 서명한 return_to 안의 값만 쓴다 (요청 주소의 next는 위조 가능)
  let rt: URL;
  try { rt = new URL(p.return_to || ''); } catch { return reject('bad_return_to'); }
  if (`${rt.origin}${rt.pathname}` !== `${siteUrl.replace(/\/$/, '')}${CALLBACK_PATH}`) return reject('return_to_mismatch');

  const signed = (p.signed || '').split(',');
  if (!REQUIRED_SIGNED.every((f) => signed.includes(f))) return reject('unsigned_fields');

  // 같은 응답을 나중에 다시 쓰는 것(재사용) 막기: 스팀의 1회용 확인 + 우리 쪽 시간 제한
  const t = Date.parse((p.response_nonce || '').slice(0, 20));
  if (!Number.isFinite(t) || Math.abs(nowMs - t) > NONCE_MAX_AGE_MS) return reject('stale_nonce');

  return { ok: true, steamId: m[1], next: sanitizeNext(rt.searchParams.get('next')) };
}

// 스팀 서버에 되묻기. 받은 openid.* 를 그대로 보내되 mode만 check_authentication으로 바꾼다
export async function askSteamIsValid(query: URLSearchParams, fetchImpl: typeof fetch = fetch): Promise<boolean> {
  const body = new URLSearchParams();
  for (const [k, v] of query) if (k.startsWith('openid.')) body.set(k, v);
  body.set('openid.mode', 'check_authentication');
  try {
    const res = await fetchImpl(STEAM_OPENID_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return false;
    return (await res.text()).split(/\r?\n/).some((line) => line.trim() === 'is_valid:true');
  } catch {
    return false;
  }
}

export async function verifySteamLogin(query: URLSearchParams, siteUrl: string, fetchImpl: typeof fetch = fetch): Promise<SteamLoginResult> {
  const local = checkAssertion(query, siteUrl);
  if (!local.ok) return local;
  return (await askSteamIsValid(query, fetchImpl)) ? local : reject('steam_said_invalid');
}
