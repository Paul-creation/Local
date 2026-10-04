// 게시글 ↔ 게임·필터 자동 연결 (서버 전용 — community.ts의 service role db를 씀)
// - 관련 게임: 글 작성·수정 때 한 번만 매칭해서 posts.related_game_ids에 저장 (조회 때는 저장값만 읽음)
// - 인원·비교·할인 링크: 저장 없이 글자에서 바로 계산 (정규식이라 가볍다)
// - 링크 주소에는 숫자와 게임 id만 넣는다 (글 내용을 주소에 넣지 않음)
import { db } from './community';
import { buildMatchers, matchGames, MAX_RELATED } from './gameMatch.mjs';
import { MAX_COMPARE } from './compareRule';
import { LARGE_LOBBY } from './players';
import { selectGames } from './visibleGames';

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// 게임 이름 목록은 10분 동안 메모리에 두고 재사용 (글 쓸 때마다 전체 목록을 다시 받지 않게)
const CACHE_MS = 10 * 60 * 1000;
let cache: { at: number; matchers: ReturnType<typeof buildMatchers> } | null = null;

async function getMatchers() {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.matchers;
  const rows: { id: string; name: string | null; search_name_ko: string | null }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await selectGames('id, name, search_name_ko', undefined, db).order('id').range(from, from + 999);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  cache = { at: Date.now(), matchers: buildMatchers(rows) };
  return cache.matchers;
}

// 직접 고른 게임(game_id)을 맨 앞에, 나머지는 글에 나온 순서로 최대 3개. 매칭에 실패해도 글 저장은 막지 않음
export async function findRelatedGames(title: string, body: string, pickedGameId: string | null): Promise<string[]> {
  try {
    const found = matchGames(`${title}\n${body}`, await getMatchers(), MAX_RELATED + 1);
    return [...new Set([...(pickedGameId ? [pickedGameId] : []), ...found])].slice(0, MAX_RELATED);
  } catch {
    return pickedGameId ? [pickedGameId] : [];
  }
}

// related_game_ids 칸이 아직 없을 때(마이그레이션 실행 전)는 그 칸만 빼고 다시 저장
export const isMissingRelatedColumn = (e: { message?: string } | null) => !!e && /related_game_ids/.test(e.message || '');

export type PostHints = { players: number[]; sale: boolean; vs: boolean };

// "4명", "8 인" → 2~16명만. "1인용"·"100명" 같은 건 무시. 서로 다른 숫자 최대 2개
export function postHints(text: string): PostHints {
  const players: number[] = [];
  for (const m of text.matchAll(/(?<!\d)(\d+)\s*(명|인)/g)) {
    const n = Number(m[1]);
    if (n >= 2 && n <= LARGE_LOBBY && !players.includes(n)) players.push(n);
    if (players.length >= 2) break;
  }
  return {
    players,
    sale: /할인|세일/.test(text),
    vs: /(^|[^a-z])vs([^a-z]|$)/i.test(text),
  };
}

export const playersLink = (n: number) => `/games?players=${n}`;
export const SALE_LINK = '/games?sale=1';
export const compareLink = (ids: string[]) => `/compare/new?games=${ids.filter((id) => UUID.test(id)).slice(0, MAX_COMPARE).join(',')}`;
