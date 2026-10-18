// 메인 "인원별 추천" 데이터 — 인원 4종(2·3·4·5인 이상)의 후보를 서버에서 한 번에 골라 메인 HTML에 실어 보낸다 ("인기 급상승" 기준, 규칙은 lib/trending)
// 후보: 그 인원이 지원 범위에 들어가는 게임 (최소 인원 ≤ N ≤ 친구끼리 최대 인원, 5인 이상은 최대 인원 5 이상) + 1인 전용 제외 + 최대 인원 상한(2인 4, 3인 6, 4인 8, 5인 이상 16) + 동접 300 이상
// 칸 두 개: 재부상(신작이 아니고 동접 증가율 1.2 이상) · 신작(출시 90일 이내 + 리뷰 10만 미만). 각각 점수 상위 12·6개 풀에서 한국 시간 날짜를 시드로 5·3개를 골라 8개를 보낸다 (같은 날은 누구에게나 같은 순서)
// 지금 뜨는 게임에 보이는 게임(excludeIds, 모든 탭 10위까지)은 뺀다
// 브라우저는 이 8개 중 앞 3개(재부상 2 + 신작 1)를 보여주고, 내 PC 사양으로 거르는 건 브라우저(PeopleRecs)에서 통과한 게임만 앞에서부터 3개 (lib/peopleShow.ts)
// 게임 카드 칸은 상세 "비슷한 게임"과 같은 getCardGames
import { friendsMax } from './playersMatch';
import { PEOPLE_SHOW, PEOPLE_CANDIDATES } from './peopleShow';
import type { SpecLike } from './specJudge';
import { getCardGames } from './gameIndex';
import { getCardExtras } from './cardExtras';
import type { CardExtras } from './cardInfo';
import { selectGames, selectHomeGames } from './visibleGames';
import { supabase } from './supabase';
import { readAllPages } from './paged';
import { MIN_PLAYERS, STREAMER_DAYS, classify, pickSlots, playerGrowth, streamerSum, type Sample, type TrendBadge } from './trending';

export const PEOPLE_CHOICES = [2, 3, 4, 5] as const; // 5는 "5인 이상"
export type PeopleN = (typeof PEOPLE_CHOICES)[number];
export { PEOPLE_SHOW, PEOPLE_CANDIDATES };
export { pickDaily } from './trending';
// 인원별 친구끼리 최대 인원 상한 — 대규모 멀티가 소규모 추천에 섞이지 않게
const MAX_CAP: Record<PeopleN, number> = { 2: 4, 3: 6, 4: 8, 5: 16 };
const DAY = 86400_000;
const HISTORY_DAYS = 11; // 동접 증가율이 보는 가장 먼 기록 (7일 전 같은 3일 = 7~10일 전, 대체 구간 4~11일 전)

// 게임 카드 칸은 목록(gameIndex)과 같은 느슨한 모양
export type CardGame = { id: string; spec_min?: SpecLike | null; [key: string]: unknown };
export type PeopleRecs = { games: Record<string, CardGame>; ids: Record<PeopleN, string[]>; badges: Record<string, TrendBadge[]> };

type Row = { id: string; min_players: number | null; max_players: number | null; party_max: number | null; current_players: number | null; release_date: string | null; review_total: number | null; recent_review_count: number | null };

export const fitsPeople = (g: Pick<Row, 'min_players' | 'max_players' | 'party_max'>, n: PeopleN) => {
  if (g.max_players === 1) return false; // 1인 전용
  const max = friendsMax(g);
  if (!max) return false;
  if (max > MAX_CAP[n]) return false;
  return n >= 5 ? max >= 5 : (g.min_players || 1) <= n && max >= n;
};

// 한국 시간 기준 오늘 날짜(YYYY-MM-DD) — 로테이션 시드
const kstDate = (now = new Date()) => new Date(now.getTime() + 9 * 3600_000).toISOString().slice(0, 10);

// 게임별 동접 기록 (최근 11일) — 읽기 실패면 null (그러면 재부상 칸이 비고 신작만 남는다)
async function readPlayerSamples(now: number): Promise<Map<string, Sample[]> | null> {
  const since = new Date(now - HISTORY_DAYS * DAY).toISOString();
  const { data, error } = await readAllPages<{ game_id: string; player_count: number; recorded_at: string }>((from, to) =>
    supabase.from('player_history').select('game_id, player_count, recorded_at').gte('recorded_at', since).order('recorded_at').order('id').range(from, to));
  if (error || !data) return null;
  const out = new Map<string, Sample[]>();
  for (const r of data) {
    const list = out.get(r.game_id) ?? [];
    list.push({ age: (now - new Date(r.recorded_at).getTime()) / DAY, count: r.player_count });
    out.set(r.game_id, list);
  }
  return out;
}

// 게임별 스트리머 영상 나이(일) — 최근 14일. 못 읽으면 빈 맵 (스트리머 신호만 빠짐)
async function readStreamerAges(now: number): Promise<Map<string, number[]>> {
  const since = new Date(now - STREAMER_DAYS * DAY).toISOString();
  const { data } = await readAllPages<{ game_id: string; published_at: string }>((from, to) =>
    supabase.from('streamer_videos').select('game_id, published_at').gte('published_at', since).order('published_at', { ascending: false }).order('video_id').range(from, to));
  const out = new Map<string, number[]>();
  for (const r of data ?? []) {
    const list = out.get(r.game_id) ?? [];
    list.push((now - new Date(r.published_at).getTime()) / DAY);
    out.set(r.game_id, list);
  }
  return out;
}

export async function getPeopleRecs(excludeIds: string[]): Promise<PeopleRecs | null> {
  const { data, error } = await selectHomeGames('id, min_players, max_players, party_max, current_players, release_date, review_total, recent_review_count')
    .gte('current_players', MIN_PLAYERS)
    .order('current_players', { ascending: false, nullsFirst: false }).order('id')
    .limit(1000); // 동접 300 이상이 1,000개를 넘지 않는다 (Supabase 한 번에 최대 1000행)
  if (error || !data?.length) return null;
  const nowDate = new Date();
  const now = nowDate.getTime();
  const today = kstDate(nowDate);
  const [samples, streamerAges] = await Promise.all([readPlayerSamples(now).catch(() => null), readStreamerAges(now).catch(() => new Map<string, number[]>())]);
  const skip = new Set(excludeIds);

  const trend = new Map<string, { kind: 'rising' | 'new'; score: number; badges: TrendBadge[] }>();
  for (const g of (data as unknown as Row[]).filter((g) => !skip.has(g.id))) {
    const t = classify({
      current: g.current_players,
      ageDays: g.release_date ? (now - new Date(g.release_date).getTime()) / DAY : null,
      reviewTotal: g.review_total,
      recentReviews: g.recent_review_count,
      gp: playerGrowth(samples?.get(g.id) ?? [])?.gp ?? null,
      streamer: streamerSum(streamerAges.get(g.id) ?? []),
    });
    if (t) trend.set(g.id, t);
  }
  const byScore = (kind: 'rising' | 'new', n: PeopleN) => (data as unknown as Row[])
    .filter((g) => trend.get(g.id)?.kind === kind && fitsPeople(g, n))
    .sort((a, b) => trend.get(b.id)!.score - trend.get(a.id)!.score || a.id.localeCompare(b.id))
    .map((g) => g.id);
  const picked = Object.fromEntries(PEOPLE_CHOICES.map((n) => [n, pickSlots(byScore('rising', n), byScore('new', n), `${today}:${n}`)])) as Record<PeopleN, string[]>;
  const unique = [...new Set(Object.values(picked).flat())];
  try {
    // 평가·태그·한국어 지원은 카드 칸에 없어 따로 읽어 덧붙인다 (못 읽으면 그 줄만 빠짐)
    const [cards, extras] = await Promise.all([getCardGames(unique), getCardExtras(unique).catch(() => ({} as Record<string, CardExtras>))]);
    // 칩은 안 쓰는 카드라 태그 번호는 보내지 않는다
    const games = Object.fromEntries((cards as CardGame[]).map(({ tag_ids, ...g }) => { void tag_ids; return [g.id, { ...g, ...extras[g.id] } as CardGame]; }));
    const ids = Object.fromEntries(PEOPLE_CHOICES.map((n) => [n, picked[n].filter((id) => games[id])])) as Record<PeopleN, string[]>;
    const badges = Object.fromEntries(unique.filter((id) => games[id] && trend.get(id)?.badges.length).map((id) => [id, trend.get(id)!.badges]));
    return { games, ids, badges };
  } catch {
    return null;
  }
}

// 메인에 나오면 안 되는 게임(home_excluded) id — 찜 기반 추천이 브라우저에서 전체 목록으로 카드를 만들 때 거르는 용도 (몇 개 안 됨)
export async function getHomeExcludedIds(): Promise<string[]> {
  const { data } = await selectGames('id').eq('home_excluded', true);
  return (data || []).map((g) => g.id as string);
}
