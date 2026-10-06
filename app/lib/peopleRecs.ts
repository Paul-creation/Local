// 메인 "인원별 추천" 데이터 — 인원 4종(2·3·4·5인 이상)의 후보를 서버에서 한 번에 골라 메인 HTML에 실어 보낸다
// 조건: 그 인원이 지원 범위에 들어가는 게임 (최소 인원 ≤ N ≤ 친구끼리 최대 인원, 5인 이상은 최대 인원 5 이상) + 1인 전용 제외 + 스팀 최근 평가가 있는 게임 (docs/recent-reviews.md: 30개 이상)
// 정렬: 인기순 (heat_rank 작은 순, 없으면 뒤로 → 최근 평가 수 많은 순). 지금 뜨는 게임에 보이는 게임(excludeIds)은 뺀다
// 내 PC 사양으로 거르는 건 브라우저(PeopleRecs)라 인원마다 3장보다 넉넉히(PER_N) 담는다. 게임 카드 칸은 상세 "비슷한 게임"과 같은 getCardGames
import { friendsMax } from './playersMatch';
import type { SpecLike } from './specJudge';
import { getCardGames } from './gameIndex';
import { selectGames, selectHomeGames } from './visibleGames';

export const PEOPLE_CHOICES = [2, 3, 4, 5] as const; // 5는 "5인 이상"
export type PeopleN = (typeof PEOPLE_CHOICES)[number];
export const PEOPLE_SHOW = 3;
const PER_N = 12;
const MIN_RECENT_REVIEWS = 30;

// 게임 카드 칸은 목록(gameIndex)과 같은 느슨한 모양
export type CardGame = { id: string; spec_min?: SpecLike | null; [key: string]: unknown };
export type PeopleRecs = { games: Record<string, CardGame>; ids: Record<PeopleN, string[]> };

type Row = { id: string; min_players: number | null; max_players: number | null; party_max: number | null; heat_rank: number | null; recent_review_count: number | null };

export const fitsPeople = (g: Pick<Row, 'min_players' | 'max_players' | 'party_max'>, n: PeopleN) => {
  if (g.max_players === 1) return false; // 1인 전용
  const max = friendsMax(g);
  if (!max) return false;
  return n >= 5 ? max >= 5 : (g.min_players || 1) <= n && max >= n;
};

export async function getPeopleRecs(excludeIds: string[]): Promise<PeopleRecs | null> {
  const { data, error } = await selectHomeGames('id, min_players, max_players, party_max, heat_rank, recent_review_count')
    .gte('recent_review_count', MIN_RECENT_REVIEWS)
    .limit(2000);
  if (error || !data?.length) return null;
  const skip = new Set(excludeIds);
  const sorted = (data as unknown as Row[])
    .filter((g) => !skip.has(g.id))
    .sort((a, b) => (a.heat_rank ?? Infinity) - (b.heat_rank ?? Infinity) || (b.recent_review_count ?? 0) - (a.recent_review_count ?? 0));
  const picked = Object.fromEntries(PEOPLE_CHOICES.map((n) => [n, sorted.filter((g) => fitsPeople(g, n)).slice(0, PER_N).map((g) => g.id)])) as Record<PeopleN, string[]>;
  const unique = [...new Set(Object.values(picked).flat())];
  try {
    const cards = await getCardGames(unique);
    // 칩은 안 쓰는 카드라 태그 번호는 보내지 않는다
    const games = Object.fromEntries((cards as CardGame[]).map(({ tag_ids, ...g }) => { void tag_ids; return [g.id, g as CardGame]; }));
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
