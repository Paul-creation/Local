// 스팀 로그인의 realm·return_to·로그인 뒤 이동 주소로 쓸 origin 고르기 — 지금 요청의 origin이 허용 목록에 있을 때만 그대로 쓰고, 아니면 운영 주소.
// 프리뷰(Vercel)에서도 로그인되게 하려는 것. 허용 목록 밖의 주소는 어떤 헤더로 와도 쓰지 않으므로 로그인 뒤 다른 사이트로 보내는 일(오픈 리다이렉트)이 없다.
// 허용: 운영 주소(SITE_URL), https://select-screen.com, https://www.select-screen.com, 이 배포의 VERCEL_URL·VERCEL_BRANCH_URL,
//       이 프로젝트의 프리뷰 주소(game-info-hub-…-paul-shin-s-projects.vercel.app). http와 포트가 붙은 주소는 허용하지 않는다.
const PROD_ORIGINS = ['https://select-screen.com', 'https://www.select-screen.com'];
const PREVIEW_HOST = /^game-info-hub-[a-z0-9-]+-paul-shin-s-projects\.vercel\.app$/;

type Env = Record<string, string | undefined>;

// "https://host" 모양만 받고(경로·포트·사용자 정보 없음) 소문자 origin으로 정리. 아니면 null
function toOrigin(v: string | null | undefined): string | null {
  if (!v) return null;
  try {
    const u = new URL(v.includes('://') ? v : `https://${v}`);
    if (u.protocol !== 'https:' || u.port || u.username || u.password || u.pathname !== '/' || u.search || u.hash) return null;
    return u.origin;
  } catch {
    return null;
  }
}

export function isAllowedAuthOrigin(origin: string, siteUrl: string, env: Env = process.env): boolean {
  const o = toOrigin(origin);
  if (!o) return false;
  if (o === toOrigin(siteUrl) || PROD_ORIGINS.includes(o)) return true;
  if (o === toOrigin(env.VERCEL_URL) || o === toOrigin(env.VERCEL_BRANCH_URL)) return true;
  return PREVIEW_HOST.test(new URL(o).host);
}

// host: 요청의 Host(프록시 뒤라면 x-forwarded-host). 허용 목록에 없으면 siteUrl(운영 주소)
export function resolveAuthOrigin(host: string | null | undefined, siteUrl: string, env: Env = process.env): string {
  const fallback = siteUrl.replace(/\/$/, '');
  const o = toOrigin(host);
  return o && isAllowedAuthOrigin(o, siteUrl, env) ? o : fallback;
}

export function requestHost(headers: Headers): string | null {
  return headers.get('x-forwarded-host')?.split(',')[0].trim() || headers.get('host');
}
