// 메인 검색·필터·자동완성·비교 선택에 쓰는 전체 게임 목록 (서버 전용 조회) — /api/games/list가 5분 캐시해서 내려준다
// 메인 페이지 RSC에 싣지 않고, 첫 화면을 그린 뒤 브라우저가 따로 받는다 (app/lib/useGameIndex.ts)
// 칸을 새로 쓰면 INDEX_FIELDS에 추가. 가격은 게임마다 최신 원화 1건만 (getPriceInfo와 같은 기준: 100 이상)
// 브라우저로 보내는 양을 줄이려고 가격 기록은 최신 가격 두 칸으로 펴고 빈 칸은 뺀다 (flattenGame)
// PC 사양은 spec_parsed 전체가 아니라 판정에 필요한 최소 사양의 세 칸(cpu·gpu·ram_gb)만 spec_min으로 보낸다 (읽은 칸이 하나도 없으면 칸 자체를 뺌) — 검색의 "내 PC로 돌아가는 게임" 필터용
// 태그는 이름 대신 번호(tag_ids, game_tags 표 순서대로)만 보낸다 — 이름·나무는 브라우저가 app/lib/tag-search-dict.json에서 한 번 받음
// game_tags 표가 아직 없거나 비어 있으면(마이그레이션 전) 예전 한국어 태그(tags)를 그대로 보낸다
import { supabase } from './supabase';
import { flattenGame } from './price';
import { selectGames } from './visibleGames';

export const INDEX_FIELDS = `
  id, name, search_name_ko, tags, category, difficulty,
  min_players, max_players, recommended_players, solo_playable,
  has_online_coop, has_local_coop, has_pvp,
  entry_barrier, solo_mode, party_max, session_max, multiplayer_host,
  is_free, price_type, lowest_price, steam_appid, source, cover_image_url, card_image_url, heat_rank,
  spec_parsed,
  price_history(price, discount_percent, checked_at, currency)
`;

export async function getGameIndex() {
  // GOTY 배지(goty_awards)는 기록 있는 게임만 따로 — 칸이 아직 없으면 오류를 무시하고 배지 없이
  // 크로스플레이(has_crossplay)도 지원하는 게임 id만 따로 — 마이그레이션 전이라 칸이 없으면 오류를 무시하고 빈 목록
  const [{ data: list, error }, { data: goty }, { data: cross }] = await Promise.all([
    selectGames(INDEX_FIELDS)
      .gte('price_history.price', 100)
      .order('created_at', { ascending: false })
      .order('checked_at', { referencedTable: 'price_history', ascending: false })
      .limit(1, { referencedTable: 'price_history' }),
    selectGames('id, goty_awards').not('goty_awards', 'is', null),
    selectGames('id').eq('has_crossplay', true),
  ]);
  if (error) throw new Error(`게임 목록 조회 실패: ${error.message}`);
  const gotyById = new Map((goty || []).map((g) => [g.id, g.goty_awards]));
  const crossIds = new Set((cross || []).map((g) => g.id));
  const tagIds = await getGameTagIds();
  return (list || []).map((g) => {
    const { tags, spec_parsed, ...rest } = g as typeof g & { tags?: string[] | null };
    const ids = tagIds?.get(g.id);
    return flattenGame({ ...rest, ...(tagIds ? { tag_ids: ids || [] } : { tags }), spec_min: specMinOf(spec_parsed), goty_awards: gotyById.get(g.id), ...(crossIds.has(g.id) ? { has_crossplay: true } : {}) });
  });
}

// 카드 몇 장에만 필요한 게임들 (상세 페이지 "비슷한 게임") — 전체 목록과 같은 칸·같은 모양으로, 넘긴 id 순서대로. 숨긴 게임은 빠진다
export async function getCardGames(ids: string[]) {
  if (!ids.length) return [];
  const [{ data: list, error }, { data: goty }, { data: cross }, { data: tagRows }] = await Promise.all([
    selectGames(INDEX_FIELDS)
      .in('id', ids)
      .gte('price_history.price', 100)
      .order('checked_at', { referencedTable: 'price_history', ascending: false })
      .limit(1, { referencedTable: 'price_history' }),
    selectGames('id, goty_awards').in('id', ids).not('goty_awards', 'is', null),
    selectGames('id').in('id', ids).eq('has_crossplay', true),
    supabase.from('game_tags').select('game_id, tag_id, rank').in('game_id', ids).order('rank'),
  ]);
  if (error) throw new Error(`게임 카드 조회 실패: ${error.message}`);
  const gotyById = new Map((goty || []).map((g) => [g.id, g.goty_awards]));
  const crossIds = new Set((cross || []).map((g) => g.id));
  const tagIds = new Map<string, number[]>();
  for (const r of tagRows || []) tagIds.set(r.game_id, [...(tagIds.get(r.game_id) || []), Number(r.tag_id)]);
  const byId = new Map((list || []).map((g) => {
    const { tags, spec_parsed, ...rest } = g as typeof g & { tags?: string[] | null };
    void tags; // 번호(tag_ids)만 보낸다
    return [g.id, flattenGame({ ...rest, tag_ids: tagIds.get(g.id) || [], spec_min: specMinOf(spec_parsed), goty_awards: gotyById.get(g.id), ...(crossIds.has(g.id) ? { has_crossplay: true } : {}) })] as const;
  }));
  return ids.map((id) => byId.get(id)).filter((g): g is NonNullable<typeof g> => !!g);
}

// 최소 사양 세 칸만 (cpu·gpu는 제조사별 등급, ram_gb). 하나도 못 읽은 게임은 null → flattenGame이 빼서 목록에 안 실림
type SpecMin = { cpu: Record<string, number> | null; gpu: Record<string, number> | null; ram_gb: number | null };
export function specMinOf(parsed: { min?: Partial<SpecMin> | null } | null | undefined): SpecMin | null {
  const m = parsed?.min;
  if (!m || (m.cpu == null && m.gpu == null && m.ram_gb == null)) return null;
  return { cpu: m.cpu ?? null, gpu: m.gpu ?? null, ram_gb: m.ram_gb ?? null };
}

// 게임 id → 태그 번호 (rank 순). 표가 없거나 비어 있으면 null
async function getGameTagIds() {
  const map = new Map<string, number[]>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('game_tags').select('game_id, tag_id, rank').order('game_id').order('rank').range(from, from + 999);
    if (error) return null;
    for (const r of data) {
      const list = map.get(r.game_id) || [];
      list.push(Number(r.tag_id));
      map.set(r.game_id, list);
    }
    if (data.length < 1000) break;
  }
  return map.size ? map : null;
}
