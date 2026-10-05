// 찜목록 — 게임 id 배열을 localStorage(wishlist)에만 저장한다 (서버 전송 없음). 읽기·쓰기 훅: components/wishlist/useWishlist.ts
export const WISHLIST_KEY = 'wishlist';
export const MAX_WISHLIST = 200;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// 저장된 값 → id 배열. 배열이 아니거나 JSON이 깨졌으면 빈 배열, 문자열 id가 아닌 항목·중복은 버린다
export function parseWishlist(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    if (!Array.isArray(v)) return [];
    return cleanIds(v);
  } catch {
    return [];
  }
}

export function cleanIds(list: unknown[]): string[] {
  return [...new Set(list.filter((x): x is string => typeof x === 'string' && UUID.test(x)))].slice(0, MAX_WISHLIST);
}

// 공유 주소의 ids 값(쉼표로 구분) → id 배열. 형식이 다른 항목은 버린다
export function parseIdsParam(value: string | null | undefined): string[] {
  return cleanIds((value || '').split(','));
}

export function shareQuery(ids: string[]): string {
  return `/wishlist?ids=${ids.join(',')}`;
}
