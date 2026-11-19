// /api/admin/revalidate 본문 검사와 무효화할 경로 계산 (순수 함수, 테스트 대상)
// 본문 { ids?: uuid[], curators?: handle[] } — 하나 이상 필요. ids는 게임 상세, curators는 /c/<handle>과 메인("/"·"/home-member")

import { timingSafeEqual } from 'crypto';

// uuid.ts와 같은 검사 (테스트가 .ts 확장자 없는 import를 못 따라가서 이 파일 안에 둠)
const isUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

export const MAX_IDS = 500;
export const MAX_CURATORS = 20;
export const isHandle = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9._-]{1,64}$/.test(v);

export type RevalidateTargets = { ids: string[]; curators: string[] };

export function parseRevalidateBody(body: unknown): { ok: true; value: RevalidateTargets } | { ok: false; error: string } {
  const b = (body ?? {}) as { ids?: unknown; curators?: unknown };
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return { ok: false, error: 'body must be an object' };
  let ids: string[] = [];
  let curators: string[] = [];
  if (b.ids !== undefined) {
    if (!Array.isArray(b.ids) || b.ids.length === 0 || b.ids.length > MAX_IDS || !b.ids.every((v) => typeof v === 'string' && isUuid(v))) {
      return { ok: false, error: `ids must be 1..${MAX_IDS} uuid strings` };
    }
    ids = [...new Set(b.ids as string[])];
  }
  if (b.curators !== undefined) {
    if (!Array.isArray(b.curators) || b.curators.length === 0 || b.curators.length > MAX_CURATORS || !b.curators.every(isHandle)) {
      return { ok: false, error: `curators must be 1..${MAX_CURATORS} handle strings` };
    }
    curators = [...new Set(b.curators as string[])];
  }
  if (!ids.length && !curators.length) return { ok: false, error: 'ids or curators required' };
  return { ok: true, value: { ids, curators } };
}

export function pathsToRevalidate({ ids, curators }: RevalidateTargets): string[] {
  const paths = ids.map((id) => `/games/${id}`);
  if (curators.length) paths.push(...curators.map((h) => `/c/${h}`), '/', '/home-member');
  return paths;
}

// x-admin-key 비교 — 둘 다 비어 있지 않고 같을 때만 true (환경변수가 비어 있으면 항상 false = 401)
export function keyMatches(given: string, expected: string): boolean {
  if (!expected || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Supabase Database Webhook 본문 { type, table, record, old_record } — curators·curator_posts 변경을 큐레이터 핸들로 바꾼다
// curators: record.handle과 old_record.handle(이름을 바꾼 경우 옛 주소도 갱신). curator_posts: record·old_record의 curator_id를 lookup(curators.handle 조회)으로 핸들로
type WebhookRow = { handle?: unknown; curator_id?: unknown } | null | undefined;
export const WEBHOOK_TYPES = ['INSERT', 'UPDATE', 'DELETE'] as const;
export const WEBHOOK_TABLES = ['curators', 'curator_posts'] as const;

export function isWebhookBody(body: unknown): boolean {
  const b = body as { type?: unknown; table?: unknown } | null;
  return typeof b === 'object' && b !== null && !Array.isArray(b) && typeof b.type === 'string' && typeof b.table === 'string';
}

export async function webhookTargets(
  body: unknown,
  lookupHandles: (curatorIds: string[]) => Promise<string[]>,
): Promise<{ ok: true; value: RevalidateTargets } | { ok: false; error: string }> {
  const b = body as { type?: string; table?: string; record?: WebhookRow; old_record?: WebhookRow };
  if (!(WEBHOOK_TYPES as readonly string[]).includes(b.type || '')) return { ok: false, error: 'unsupported webhook type' };
  if (!(WEBHOOK_TABLES as readonly string[]).includes(b.table || '')) return { ok: false, error: 'unsupported webhook table' };
  const rows = [b.record, b.old_record].filter((r): r is NonNullable<WebhookRow> => typeof r === 'object' && r !== null);
  let curators: string[] = [];
  if (b.table === 'curators') {
    curators = rows.map((r) => r.handle).filter(isHandle);
  } else {
    const curatorIds = [...new Set(rows.map((r) => r.curator_id).filter((v): v is string => typeof v === 'string' && isUuid(v)))];
    if (curatorIds.length) curators = (await lookupHandles(curatorIds)).filter(isHandle);
  }
  return { ok: true, value: { ids: [], curators: [...new Set(curators)].slice(0, MAX_CURATORS) } };
}
