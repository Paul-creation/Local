// /api/admin/revalidate 본문 검사와 무효화할 경로 계산 (순수 함수, 테스트 대상)
// 본문 { ids?: uuid[], curators?: handle[] } — 하나 이상 필요. ids는 게임 상세, curators는 /c/<handle>과 메인("/"·"/home-member")

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
