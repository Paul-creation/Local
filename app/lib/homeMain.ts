// 메인 리디자인 전용 데이터 — 히어로 숫자·배경 표지·세로 표지·출시 예정·다시 뜨는 중·인기 차트 줄
// 숫자·표지·가격은 DB 값만 쓰고, 읽지 못한 항목은 null/빈 목록으로 돌려줘서 화면이 그 부분을 숨긴다
import { selectGames, selectHomeGames } from './visibleGames';
import { readAllPages } from './paged';
import { getPriceInfo } from './price';
import { playersText } from './players';
import { gameName } from './gameName';
import type { HotItem } from './hotChart';
import { arrangeHeroWall } from './heroWall';

export type Cover = { vertical: string | null; appid: string | null; wide: string | null };
export type ListRow = { id: string; name: string; cover: Cover; sub: string[] };
export type HomeLists = { popular: ListRow[]; upcoming: ListRow[]; rising: ListRow[] };
export type HomeStats = { games: number | null; sale: number | null; soon: number | null };

export const LIST_SIZE = 5;

type CoverRow = { id: string; cover_vertical_url: string | null; steam_appid: string | null; card_image_url: string | null; cover_image_url: string | null };
const COVER_FIELDS = 'id, cover_vertical_url, steam_appid, card_image_url, cover_image_url';
const coverOf = (g: Omit<CoverRow, 'id'>): Cover => ({ vertical: g.cover_vertical_url, appid: g.steam_appid, wide: g.card_image_url || g.cover_image_url });

// 게임 id들의 표지 정보 (세로 표지 주소·스팀 앱 ID·가로 대체 이미지)
export async function getCovers(ids: string[]): Promise<Record<string, Cover>> {
  if (!ids.length) return {};
  const { data } = await selectGames(COVER_FIELDS).in('id', [...new Set(ids)]);
  return Object.fromEntries(((data ?? []) as unknown as CoverRow[]).map((g) => [g.id, coverOf(g)]));
}

// 히어로 배경 — 세로 표지 벽. 열 단위(3줄)로 채우므로 2560px 폭 기준 17열 × 3줄 = 51장 (모바일은 앞 27장만 쓴다, mn.css)
// 구성: 협동 게임(지정 20개) + 기존 인기순 명작 + 모자라면 온라인 협동 가능 게임을 동접 순으로 채움. 표지는 DB 값만 쓰고 DB에 없는 게임은 빠진다
export const HERO_COVER_COUNT = 51;
const HERO_COOP_NAMES = ['Rust', 'Sea of Thieves: 2026 Edition', 'Lethal Company', 'Phasmophobia', 'Deep Rock Galactic', 'Valheim', 'It Takes Two', 'Split Fiction', "Don't Starve Together", 'Dead by Daylight', 'HELLDIVERS™ 2', 'Raft', 'Grounded', 'Overcooked! 2', 'PEAK', 'R.E.P.O.', 'Palworld / 팰월드', 'Monster Hunter Wilds', 'PUBG: BATTLEGROUNDS', 'Among Us'];
// 동접 순 채움에서 뺄 것 — 방치형·클리커류(태그)와 Bongo Cat
const HERO_FILL_SKIP_TAG = /방치|idle|clicker|클리커/i;
const HERO_FILL_SKIP_NAMES = ['Bongo Cat'];

type HeroRow = { id: string; name: string; cover_vertical_url: string; tags?: string[] | null };
export async function getHeroCovers(): Promise<string[]> {
  const base = () => selectHomeGames('id, name, cover_vertical_url, tags')
    .is('merged_into', null)
    .not('cover_vertical_url', 'is', null)
    .neq('cover_vertical_url', '');
  const [coopRes, topRes, fillRes] = await Promise.all([
    base().in('name', HERO_COOP_NAMES),
    base().order('heat_rank', { ascending: true, nullsFirst: false }).order('id').limit(24),
    base().eq('has_online_coop', true).order('current_players', { ascending: false, nullsFirst: false }).order('id').limit(60),
  ]);
  const seen = new Set<string>();
  const take = (rows: unknown, limit = Infinity) => {
    const out: HeroRow[] = [];
    for (const g of (rows ?? []) as HeroRow[]) {
      if (out.length >= limit || seen.has(g.id)) continue;
      seen.add(g.id);
      out.push(g);
    }
    return out;
  };
  const coop = take(coopRes.data);
  const singles = take(topRes.data);
  const fillRows = ((fillRes.data ?? []) as unknown as HeroRow[]).filter((g) => !HERO_FILL_SKIP_NAMES.includes(g.name) && !(g.tags ?? []).some((t) => HERO_FILL_SKIP_TAG.test(t)));
  const fill = take(fillRows, Math.max(0, HERO_COVER_COUNT - coop.length - singles.length));
  // 협동(지정+채움)과 기존 명작을 번갈아, 밝은 표지·어두운 표지도 번갈아 놓는다 (lib/heroWall)
  return arrangeHeroWall([...coop, ...fill], singles).slice(0, HERO_COVER_COUNT).map((g) => g.cover_vertical_url);
}

// 히어로 숫자 3개 — 기준은 숨기지 않은(hidden=false) 게임 중 합쳐지지 않은(merged_into null) 게임
// 할인 중 = 가격 기록이 있는 게임 중 최신 원화 가격의 할인율이 0보다 큰 게임 (검색의 "지금 할인 중" 필터와 같은 getPriceInfo 기준)
// 출시 예정 = release_status coming_soon (데모 여부와 무관)
export async function getHomeStats(): Promise<HomeStats> {
  const [total, soon, sale] = await Promise.all([
    selectGames('id', { count: 'exact', head: true }).is('merged_into', null),
    selectGames('id', { count: 'exact', head: true }).is('merged_into', null).eq('release_status', 'coming_soon'),
    readAllPages((from, to) => selectGames('id, price_type, price_history(price, discount_percent, checked_at, original_price)')
      .is('merged_into', null)
      .gte('price_history.price', 100)
      .order('id')
      .order('checked_at', { referencedTable: 'price_history', ascending: false })
      .limit(1, { referencedTable: 'price_history' })
      .range(from, to)),
  ]);
  return {
    games: total.error ? null : total.count,
    soon: soon.error ? null : soon.count,
    sale: sale.error || !sale.data ? null : sale.data.filter((g) => (getPriceInfo(g)?.discount ?? 0) > 0).length,
  };
}

// 출시 예정 — 출시일이 가까운 순 (날짜 없이 "2027년 1분기"처럼 글자만 있는 게임은 뒤)
const SOON_FIELDS = `id, name, display_name, min_players, max_players, release_date_text, ${COVER_FIELDS.replace('id, ', '')}`;
const PLACEHOLDER = /^(출시\s*예정|coming\s*soon|to\s*be\s*announced|tba)$/i;
async function upcomingRows(): Promise<ListRow[]> {
  const { data } = await selectGames(SOON_FIELDS)
    .is('merged_into', null)
    .eq('home_excluded', false)
    .eq('release_status', 'coming_soon')
    .order('release_date', { ascending: true, nullsFirst: false })
    .order('id')
    .limit(LIST_SIZE);
  type Row = CoverRow & { name: string; display_name: string | null; min_players: number | null; max_players: number | null; release_date_text: string | null };
  return ((data ?? []) as unknown as Row[]).map((g) => {
    const text = (g.release_date_text ?? '').trim();
    return { id: g.id, name: gameName(g), cover: coverOf(g), sub: [text && !PLACEHOLDER.test(text) ? text : '출시 예정', playersText(g)].filter(Boolean) };
  });
}

// 다시 뜨는 중 — 게임 판정(trend_badge = rising_old) 점수 높은 순
const RISING_FIELDS = `id, name, display_name, min_players, max_players, is_free, price_type, ${COVER_FIELDS.replace('id, ', '')}, price_history(price, discount_percent, checked_at, original_price)`;
async function risingRows(): Promise<ListRow[]> {
  const { data } = await selectHomeGames(RISING_FIELDS)
    .is('merged_into', null)
    .eq('trend_badge', 'rising_old')
    .gte('price_history.price', 100)
    .order('trend_score', { ascending: false, nullsFirst: false })
    .order('id')
    .order('checked_at', { referencedTable: 'price_history', ascending: false })
    .limit(1, { referencedTable: 'price_history' })
    .limit(LIST_SIZE);
  type Row = CoverRow & { name: string; display_name: string | null; min_players: number | null; max_players: number | null; is_free: boolean | null; price_type: string | null };
  return ((data ?? []) as unknown as Row[]).map((g) => {
    const price = getPriceInfo(g);
    return { id: g.id, name: gameName(g), cover: coverOf(g), sub: [playersText(g), g.is_free ? '무료' : price ? price.formattedFinal : ''].filter(Boolean) };
  });
}

// 인기 차트 — 기존 "지금 뜨는 게임"의 첫 탭 순위 그대로 (이름만 바뀜)
async function popularRows(items: HotItem[]): Promise<ListRow[]> {
  const top = items.slice(0, LIST_SIZE);
  const covers = await getCovers(top.map((i) => i.id));
  return top.map((i) => ({
    id: i.id,
    name: i.name,
    cover: covers[i.id] ?? { vertical: null, appid: null, wide: i.thumb },
    sub: [i.players, i.price ? (i.discount > 0 ? `${i.price} (-${i.discount}%)` : i.price) : ''].filter(Boolean),
  }));
}

export async function getHomeLists(hotItems: HotItem[]): Promise<HomeLists> {
  const [popular, upcoming, rising] = await Promise.all([popularRows(hotItems).catch(() => []), upcomingRows().catch(() => []), risingRows().catch(() => [])]);
  // 세로 표지가 없는 게임의 대체 이미지가 비어 있으면 줄에서 뺄 필요는 없다 — PosterImage가 빈 칸으로 그린다
  return { popular, upcoming, rising };
}
