// 담당: Paul(메인 배너·디자인)
// 메인 "🔥 지금 뜨는 게임" 데이터 — 메인 select와 따로, 필요한 게임과 기록만 가져온다
// 순위는 scripts/snapshot-hot-rank.mjs가 매일 hot_rank_history에 남긴 heat_rank 순위(상위 50)를 쓴다
import { supabase } from './supabase';
import { playersText } from './players';
import { getPriceInfo, getLowestTiming, PRICE_TYPE_LABEL, type LowestTiming } from './price';
import { translateTag } from './tagTranslate';
import { selectHomeGames } from './visibleGames';

export type RankChange = { type: 'up' | 'down'; n: number } | { type: 'same' } | { type: 'new' } | null;

export type HotItem = {
  id: string;
  name: string;
  rank: number;           // 탭 안에서의 순위 (1~10)
  change: RankChange;     // 어제 대비 (급상승 탭은 7일 전 대비)
  weeks: number;          // 연속으로 상위 10위 안에 든 주 수
  image: string | null;   // 큰 카드 배경 (card → hero). 카드 칸이 16:8이라 3:1인 hero는 좌우가 35% 잘려서 16:9 카드 이미지 먼저
  thumb: string | null;   // 줄 썸네일 (card → cover)
  fun: string | null;
  tags: string[];         // 한국어 태그 앞 2개
  players: string;        // "1-4인"
  currentPlayers: number | null;
  price: string | null;   // "₩8,250" / "무료" / "월 구독" (가격 유형 게임)
  discount: number;
  lowest: LowestTiming;   // 역대 최저가 / 최저가 근접
  spark: number[];        // 최근 7일 동접자 (1~3위만, 기록이 3일 이상인 게임만)
  streamers?: string[];   // 이 게임을 플레이한 스트리머 (최근 영상 순, app/page.tsx에서 한 번에 채움)
};

export type HotTab = { key: 'all' | 'friends' | 'rising'; label: string; items: HotItem[] };

const DAY = 24 * 3600 * 1000;
const addDays = (date: string, days: number) => new Date(new Date(date + 'T00:00:00Z').getTime() + days * DAY).toISOString().slice(0, 10);

async function latestDate(before?: string, onOrBefore?: string) {
  let q = supabase.from('hot_rank_history').select('snapshot_date').order('snapshot_date', { ascending: false }).limit(1);
  if (before) q = q.lt('snapshot_date', before);
  if (onOrBefore) q = q.lte('snapshot_date', onOrBefore);
  const { data } = await q;
  return (data?.[0]?.snapshot_date as string | undefined) || null;
}

async function ranksOn(date: string | null) {
  if (!date) return new Map<string, number>();
  const { data } = await supabase.from('hot_rank_history').select('game_id, rank').eq('snapshot_date', date).order('rank');
  return new Map((data || []).map((r) => [r.game_id as string, r.rank as number]));
}


// 오늘(가장 최근 기록) 상위 10위 게임 id — 검색 결과·상세 페이지 "TOP 10" 배지용
export async function getTop10Ids(): Promise<string[]> {
  const date = await latestDate();
  if (!date) return [];
  const { data } = await supabase.from('hot_rank_history').select('game_id').eq('snapshot_date', date).lte('rank', 10);
  return (data || []).map((r) => r.game_id as string);
}

export async function getHotChart(): Promise<{ tabs: HotTab[]; top10Ids: string[]; date: string | null }> {
  const latest = await latestDate();
  if (!latest) return { tabs: [], top10Ids: [], date: null };

  // 오늘 / 어제(직전 기록) / 7일 전(그 날 또는 그 이전 가장 가까운 기록, 2주 안)
  const [prevDate, weekDate] = await Promise.all([latestDate(latest), latestDate(undefined, addDays(latest, -7))]);
  const weekOk = weekDate && weekDate >= addDays(latest, -13) ? weekDate : null;
  const [today, prev, weekAgo] = await Promise.all([ranksOn(latest), ranksOn(prevDate), ranksOn(weekOk)]);
  const ranked50 = [...today.entries()].sort((a, b) => a[1] - b[1]).map(([id]) => id);

  // 친구랑 탭을 고르려면 상위 50개의 인원만 필요 (작은 칸 하나)
  // 숨긴 게임·메인 노출 제외 게임은 여기서 빠지고, 그 아래 순위가 한 칸씩 올라온다
  const { data: playersRows } = await selectHomeGames('id, max_players').in('id', ranked50);
  const shown = new Set((playersRows || []).map((g) => g.id));
  const top50 = ranked50.filter((id) => shown.has(id));
  const multi = new Set((playersRows || []).filter((g) => (g.max_players || 0) >= 2).map((g) => g.id));

  const allIds = top50.slice(0, 10);
  const friendIds = top50.filter((id) => multi.has(id)).slice(0, 10);
  // 이번 주 급상승: 7일 전 대비 많이 오른 순 (7일 전 50위 밖이었으면 51위로 계산)
  const risingDelta = new Map<string, number>();
  if (weekOk) {
    for (const id of top50) risingDelta.set(id, (weekAgo.get(id) ?? 51) - today.get(id)!);
  }
  const risingIds = weekOk
    ? top50.filter((id) => risingDelta.get(id)! > 0).sort((a, b) => risingDelta.get(b)! - risingDelta.get(a)! || today.get(a)! - today.get(b)!).slice(0, 10)
    : [];

  const ids = [...new Set([...allIds, ...friendIds, ...risingIds])];
  const top3 = [...new Set([...allIds.slice(0, 3), ...friendIds.slice(0, 3), ...risingIds.slice(0, 3)])];
  const since = addDays(latest, -7 * 26);

  const [{ data: games }, { data: weeksRows }, { data: playerRows }] = await Promise.all([
    selectHomeGames('id, name, hero_image_url, card_image_url, cover_image_url, fun_description, tags, min_players, max_players, current_players, is_free, price_type, lowest_price, price_history(price, discount_percent, checked_at, currency)')
      .in('id', ids)
      .gte('price_history.price', 100)
      .order('checked_at', { referencedTable: 'price_history', ascending: false })
      .limit(1, { referencedTable: 'price_history' }),
    // N주째 순위권 계산용: 최근 26주 동안 이 게임들이 10위 안에 든 날
    supabase.from('hot_rank_history').select('game_id, snapshot_date').in('game_id', ids).lte('rank', 10).gte('snapshot_date', since),
    supabase.from('player_history').select('game_id, player_count, recorded_at').in('game_id', top3).gte('recorded_at', new Date(Date.now() - 7 * DAY).toISOString()).order('recorded_at'),
  ]);

  const byId = new Map((games || []).map((g) => [g.id, g]));
  const top10Dates = new Map<string, string[]>();
  for (const r of weeksRows || []) {
    if (!top10Dates.has(r.game_id)) top10Dates.set(r.game_id, []);
    top10Dates.get(r.game_id)!.push(r.snapshot_date);
  }
  // 이번 주부터 한 주씩 거슬러 올라가며, 그 주(7일) 안에 10위 안에 든 날이 있으면 +1, 없으면 멈춤
  const weeksOf = (id: string) => {
    const dates = top10Dates.get(id) || [];
    let n = 0;
    for (let k = 0; k < 26; k++) {
      const end = addDays(latest, -7 * k);
      const start = addDays(end, -6);
      if (!dates.some((d) => d >= start && d <= end)) break;
      n++;
    }
    return n;
  };
  const spark = new Map<string, number[]>();
  const sparkDays = new Map<string, Set<string>>();
  for (const r of playerRows || []) {
    if (!spark.has(r.game_id)) { spark.set(r.game_id, []); sparkDays.set(r.game_id, new Set()); }
    spark.get(r.game_id)!.push(r.player_count);
    sparkDays.get(r.game_id)!.add(String(r.recorded_at).slice(0, 10));
  }
  // 그래프는 기록이 3일 이상 쌓인 게임만 (하루 이틀치는 선이 의미 없음)
  for (const [id, days] of sparkDays) if (days.size < 3) spark.delete(id);

  const changeOf = (id: string): RankChange => {
    if (!prevDate) return null; // 비교할 어제 기록이 없으면 표시 안 함
    const before = prev.get(id);
    if (before == null) return { type: 'new' };
    const diff = before - today.get(id)!;
    return diff > 0 ? { type: 'up', n: diff } : diff < 0 ? { type: 'down', n: -diff } : { type: 'same' };
  };

  const toItems = (list: string[], rising = false): HotItem[] =>
    list.flatMap((id, i) => {
      const g = byId.get(id);
      if (!g) return [];
      const price = getPriceInfo(g);
      return [{
        id,
        name: g.name,
        rank: i + 1,
        change: rising ? { type: 'up' as const, n: risingDelta.get(id)! } : changeOf(id),
        weeks: weeksOf(id),
        image: g.card_image_url || g.hero_image_url || g.cover_image_url || null,
        thumb: g.card_image_url || g.cover_image_url || null,
        fun: g.fun_description || null,
        tags: (g.tags || []).slice(0, 2).map((t: string) => translateTag(t)),
        players: playersText(g),
        currentPlayers: g.current_players ?? null,
        price: g.is_free ? '무료' : price ? price.formattedFinal : PRICE_TYPE_LABEL[g.price_type] ?? null,
        discount: !g.is_free && price ? price.discount : 0,
        lowest: getLowestTiming(g, price),
        spark: i < 3 ? (spark.get(id) || []) : [],
      }];
    });

  const tabs: HotTab[] = [
    { key: 'friends' as const, label: '친구랑 하기 좋은', items: toItems(friendIds) }, // 기본 탭
    { key: 'all' as const, label: '전체', items: toItems(allIds) },
    { key: 'rising' as const, label: '이번 주 급상승', items: toItems(risingIds, true) },
  ].filter((t) => t.items.length > 0);

  return { tabs, top10Ids: allIds, date: latest };
}
