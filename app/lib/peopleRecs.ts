// 메인 "인원별 추천" 데이터 — 인원 4종(2·3·4·5인 이상)의 후보를 서버에서 한 번에 골라 메인 HTML에 실어 보낸다
// 후보: 그 인원이 지원 범위에 들어가는 게임 (최소 인원 ≤ N ≤ 친구끼리 최대 인원, 5인 이상은 최대 인원 5 이상) + 1인 전용 제외 + 최대 인원 상한(2인 4, 3인 6, 4인 8, 5인 이상 16)
// 버려진 게임 제외: 접속자 100명 미만이면서 마지막 업데이트가 2년보다 오래된 게임 (둘 다 해당할 때만. 업데이트 날짜를 모르면 거르지 않는다)
// 풀: 남은 후보 중 접속자 많은 상위 30개 → 그중 12개를 한국 시간 날짜를 시드로 골라 보낸다 (같은 날은 누구에게나 같은 순서). 지금 뜨는 게임에 보이는 게임(excludeIds)은 뺀다
// 브라우저는 이 12개 중 앞 3개를 보여주고, 내 PC 사양으로 거르는 건 브라우저(PeopleRecs)에서 통과한 게임만 앞에서부터 3개 (lib/peopleShow.ts)
// 게임 카드 칸은 상세 "비슷한 게임"과 같은 getCardGames
import { friendsMax } from './playersMatch';
import { PEOPLE_SHOW, PEOPLE_CANDIDATES } from './peopleShow';
import type { SpecLike } from './specJudge';
import { getCardGames } from './gameIndex';
import { getCardExtras } from './cardExtras';
import type { CardExtras } from './cardInfo';
import { selectGames, selectHomeGames } from './visibleGames';

export const PEOPLE_CHOICES = [2, 3, 4, 5] as const; // 5는 "5인 이상"
export type PeopleN = (typeof PEOPLE_CHOICES)[number];
export { PEOPLE_SHOW, PEOPLE_CANDIDATES };
const POOL_SIZE = 30;
// 인원별 친구끼리 최대 인원 상한 — 대규모 멀티가 소규모 추천에 섞이지 않게
const MAX_CAP: Record<PeopleN, number> = { 2: 4, 3: 6, 4: 8, 5: 16 };
const ABANDONED_PLAYERS = 100;
const ABANDONED_YEARS = 2;

// 게임 카드 칸은 목록(gameIndex)과 같은 느슨한 모양
export type CardGame = { id: string; spec_min?: SpecLike | null; [key: string]: unknown };
export type PeopleRecs = { games: Record<string, CardGame>; ids: Record<PeopleN, string[]> };

type Row = { id: string; min_players: number | null; max_players: number | null; party_max: number | null; current_players: number | null; last_updated: string | null };

export const fitsPeople = (g: Pick<Row, 'min_players' | 'max_players' | 'party_max'>, n: PeopleN) => {
  if (g.max_players === 1) return false; // 1인 전용
  const max = friendsMax(g);
  if (!max) return false;
  if (max > MAX_CAP[n]) return false;
  return n >= 5 ? max >= 5 : (g.min_players || 1) <= n && max >= n;
};

// 한국 시간 기준 오늘 날짜(YYYY-MM-DD) — 로테이션 시드
const kstDate = (now = new Date()) => new Date(now.getTime() + 9 * 3600_000).toISOString().slice(0, 10);

// 문자열 → 32비트 시드 (FNV-1a), 시드 → 난수 (mulberry32)
const hashSeed = (str: string) => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const rng = (seed: number) => () => { seed = (seed + 0x6d2b79f5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

// 풀에서 count개를 날짜+인원 시드로 고른다 (Fisher-Yates)
export const pickDaily = <T,>(pool: T[], count: number, seedKey: string): T[] => {
  const rand = rng(hashSeed(seedKey));
  const a = [...pool];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a.slice(0, count);
};

// 접속자 적고 2년 넘게 업데이트 없는 게임
const isAbandoned = (g: Pick<Row, 'current_players' | 'last_updated'>, cutoff: string) =>
  (g.current_players ?? 0) < ABANDONED_PLAYERS && !!g.last_updated && g.last_updated < cutoff;

export async function getPeopleRecs(excludeIds: string[]): Promise<PeopleRecs | null> {
  const { data, error } = await selectHomeGames('id, min_players, max_players, party_max, current_players, last_updated').order('current_players', { ascending: false, nullsFirst: false })
    .limit(1000); // 풀이 접속자순 상위라 위쪽만 읽으면 된다 (Supabase 한 번에 최대 1000행)
  if (error || !data?.length) return null;
  const skip = new Set(excludeIds);
  const now = new Date();
  const today = kstDate(now);
  const cutoff = new Date(now.getTime() + 9 * 3600_000 - ABANDONED_YEARS * 365.25 * 86400_000).toISOString().slice(0, 10);
  const alive = (data as unknown as Row[]).filter((g) => !skip.has(g.id) && !isAbandoned(g, cutoff));
  const byPlayers = alive.sort((a, b) => (b.current_players ?? 0) - (a.current_players ?? 0) || a.id.localeCompare(b.id));
  const picked = Object.fromEntries(PEOPLE_CHOICES.map((n) => [n, pickDaily(byPlayers.filter((g) => fitsPeople(g, n)).slice(0, POOL_SIZE).map((g) => g.id), PEOPLE_CANDIDATES, `${today}:${n}`)])) as Record<PeopleN, string[]>;
  const unique = [...new Set(Object.values(picked).flat())];
  try {
    // 평가·태그·한국어 지원은 카드 칸에 없어 따로 읽어 덧붙인다 (못 읽으면 그 줄만 빠짐)
    const [cards, extras] = await Promise.all([getCardGames(unique), getCardExtras(unique).catch(() => ({} as Record<string, CardExtras>))]);
    // 칩은 안 쓰는 카드라 태그 번호는 보내지 않는다
    const games = Object.fromEntries((cards as CardGame[]).map(({ tag_ids, ...g }) => { void tag_ids; return [g.id, { ...g, ...extras[g.id] } as CardGame]; }));
    const ids = Object.fromEntries(PEOPLE_CHOICES.map((n) => [n, picked[n].filter((id) => games[id])])) as Record<PeopleN, string[]>;
    return { games, ids };
  } catch {
    return null;
  }
}

// 메인에 나오면 안 되는 게임(home_excluded) id — 찜 기반 추천이 브라우저에서 전체 목록으로 카드를 만들 때 거르는 용도 (몇 개 안 됨)
export async function getHomeExcludedIds(): Promise<string[]> {
  const { data } = await selectGames('id').eq('home_excluded', true);
  return (data || []).map((g) => g.id as string);
}
