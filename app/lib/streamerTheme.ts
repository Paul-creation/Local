// 메인 "스트리머들이 밤새운 협동 게임" 섹션 — 선정은 스트리머 영상 표에서 매번 계산한다
// 그래서 매일 도는 fetch-streamer-videos(새 영상 연결)와 관리자 페이지의 숨김·채널 끄기가 따로 작업 없이 바로 반영된다 (페이지는 5분 캐시)
// 조건: 스트리머 영상이 1개 이상 + 친구끼리 최대 인원 2명 이상 + 온라인 협동 또는 로컬 협동이 true (null은 제외) + category가 순수 "협동"
// (협동·대전·혼자는 제외 — PvP 위주 게임을 거르는 기준). 개별 제외 목록은 두지 않는다
// 정렬: 플레이한 스트리머 수 → 인기(heat_rank) 순, 최대 12개 (6개 미만이면 null = 섹션 숨김)
import { supabase } from './supabase';
import { friendsMax } from './playersMatch';

export const THEME_MIN = 6; // 이보다 적으면 섹션을 숨긴다 (null)
export const THEME_MAX = 12;

export type ThemeGame = {
  id: string;
  name: string;
  image: string | null;
  streamers: string[]; // 최근 영상 순, 사람 기준 중복 없음
  videoId: string | null; // "플레이 영상 보기" — 가장 최근 영상 (쇼츠가 아닌 것 먼저)
};
export type StreamerTheme = { games: ThemeGame[] };

type One<T> = T | T[] | null;
const first = <T,>(v: One<T>): T | null => (Array.isArray(v) ? v[0] ?? null : v);
type Row = {
  video_id: string; is_short: boolean; published_at: string;
  streamer_channels: One<{ streamer_name: string }>;
  games: One<{ id: string; name: string; card_image_url: string | null; cover_image_url: string | null; category: string | null; min_players: number | null; max_players: number | null; party_max: number | null; has_online_coop: boolean | null; has_local_coop: boolean | null; heat_rank: number | null }>;
};

export async function getStreamerTheme(): Promise<StreamerTheme | null> {
  const rows: Row[] = [];
  for (let from = 0; from < 10000; from += 1000) {
    const { data, error } = await supabase
      .from('streamer_videos')
      .select('video_id, is_short, published_at, streamer_channels(streamer_name), games!inner(id, name, card_image_url, cover_image_url, category, min_players, max_players, party_max, has_online_coop, has_local_coop, heat_rank)')
      .eq('games.hidden', false)
      .eq('games.home_excluded', false)
      .order('published_at', { ascending: false })
      .range(from, from + 999);
    if (error) return null;
    rows.push(...((data || []) as unknown as Row[]));
    if (!data || data.length < 1000) break;
  }

  const byGame = new Map<string, ThemeGame & { rank: number; short: string | null }>();
  for (const r of rows) { // 최근 영상부터 들어온다
    const g = first(r.games);
    if (!g || (friendsMax(g) ?? 0) < 2) continue;
    if (g.category !== '협동') continue; // 협동·대전·혼자 제외
    if (g.has_online_coop !== true && g.has_local_coop !== true) continue; // 협동 모드가 확인된 게임만
    let item = byGame.get(g.id);
    if (!item) {
      item = { id: g.id, name: g.name, image: g.card_image_url || g.cover_image_url || null, streamers: [], videoId: null, rank: g.heat_rank ?? Infinity, short: null };
      byGame.set(g.id, item);
    }
    const name = first(r.streamer_channels)?.streamer_name;
    if (name && !item.streamers.includes(name)) item.streamers.push(name);
    if (r.is_short) item.short ??= r.video_id;
    else item.videoId ??= r.video_id;
  }

  const all = [...byGame.values()].map((g) => ({ ...g, videoId: g.videoId ?? g.short }));
  all.sort((a, b) => b.streamers.length - a.streamers.length || a.rank - b.rank);
  // 카드는 PC 6칸·태블릿 3칸·모바일 2칸 격자라 6의 배수로만 보여준다 (마지막 줄이 비는 어색한 배치 방지, 6~11개면 6개, 12개면 12개)
  if (all.length < THEME_MIN) return null;
  const shown = Math.floor(Math.min(all.length, THEME_MAX) / THEME_MIN) * THEME_MIN;
  return { games: all.slice(0, shown).map(({ rank, short, ...g }) => g) };
}
