// 큐레이터 → 인스타그램 나가는 클릭 기록의 공용 규칙 (브라우저 sendBeacon 쪽과 /api/outbound가 같이 쓴다)
export const OUTBOUND_PATH = '/api/outbound';
export const OUTBOUND_MAX_URL = 500;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID.test(v);

// https 인스타그램 주소만 (instagram.com·www.instagram.com). 아니면 null, 맞으면 정리한 주소
export function parseInstagramUrl(v: unknown): string | null {
  if (typeof v !== 'string' || v.length > OUTBOUND_MAX_URL) return null;
  try {
    const u = new URL(v);
    if (u.protocol !== 'https:' || (u.hostname !== 'instagram.com' && u.hostname !== 'www.instagram.com')) return null;
    return u.toString();
  } catch {
    return null;
  }
}

// 같은 서버 인스턴스 안에서만 세는 간단한 요청 제한 (DB·IP 저장 없음). 한도를 넘으면 false
export function makeRateLimiter(limit: number, windowMs: number, maxKeys = 5000) {
  const hits = new Map<string, { n: number; reset: number }>();
  return (key: string, now = Date.now()) => {
    if (hits.size > maxKeys) for (const [k, v] of hits) if (v.reset <= now) hits.delete(k);
    const cur = hits.get(key);
    if (!cur || cur.reset <= now) {
      hits.set(key, { n: 1, reset: now + windowMs });
      return true;
    }
    cur.n += 1;
    return cur.n <= limit;
  };
}
