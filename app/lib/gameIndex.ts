// 메인 검색·필터·자동완성·비교 선택에 쓰는 전체 게임 목록 (서버 전용 조회) — /api/games/list가 5분 캐시해서 내려준다
// 메인 페이지 RSC에 싣지 않고, 첫 화면을 그린 뒤 브라우저가 따로 받는다 (app/lib/useGameIndex.ts)
// 칸을 새로 쓰면 INDEX_FIELDS에 추가. 가격은 게임마다 최신 원화 1건만 (getPriceInfo와 같은 기준: 100 이상)
// 브라우저로 보내는 양을 줄이려고 가격 기록은 최신 가격 두 칸으로 펴고 빈 칸은 뺀다 (flattenGame)
import { supabase } from './supabase';
import { flattenGame } from './price';
import { selectGames } from './visibleGames';

export const INDEX_FIELDS = `
  id, name, search_name_ko, tags, category, difficulty,
  min_players, max_players, recommended_players, solo_playable,
  has_online_coop, has_local_coop, has_pvp,
  is_free, price_type, lowest_price, steam_appid, source, cover_image_url, card_image_url,
  price_history(price, discount_percent, checked_at, currency)
`;

export async function getGameIndex() {
  // GOTY 배지(goty_awards)는 기록 있는 게임만 따로 — 칸이 아직 없으면 오류를 무시하고 배지 없이
  const [{ data: list, error }, { data: goty }] = await Promise.all([
    selectGames(INDEX_FIELDS)
      .gte('price_history.price', 100)
      .order('created_at', { ascending: false })
      .order('checked_at', { referencedTable: 'price_history', ascending: false })
      .limit(1, { referencedTable: 'price_history' }),
    selectGames('id, goty_awards').not('goty_awards', 'is', null),
  ]);
  if (error) throw new Error(`게임 목록 조회 실패: ${error.message}`);
  const gotyById = new Map((goty || []).map((g) => [g.id, g.goty_awards]));
  return (list || []).map((g) => flattenGame({ ...g, goty_awards: gotyById.get(g.id) }));
}
