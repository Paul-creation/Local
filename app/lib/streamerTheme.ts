// 스트리머 기획전 (lib/event의 kind: 'streamer') — 선정은 스트리머 영상 표에서 매번 계산한다
// 그래서 매일 도는 fetch-streamer-videos(새 영상 연결)와 관리자 페이지의 숨김·채널 끄기가 따로 작업 없이 바로 반영된다 (페이지는 5분 캐시)
// 조건: 서로 다른 스트리머(사람 기준) N명 이상이 플레이 + 친구끼리 최대 인원 2명 이상. 3명 기준으로 8~12개가 나오면 3명, 아니면 2명 기준 (최대 12개)
// 정렬: 플레이한 스트리머 수 → 인기(heat_rank) 순
import { supabase } from './supabase';
import { friendsMax } from './playersMatch';

export const THEME_MIN = 8;
export const THEME_MAX = 12;
const THRESHOLDS = [3, 2];

export type ThemeGame = {
  id: string;
  name: string;
  image: string | null;
  streamers: string[]; // 최근 영상 순, 사람 기준 중복 없음
  videoId: string | null; // "플레이 영상 보기" — 가장 최근 영상 (쇼츠가 아닌 것 먼저)
};
export type StreamerTheme = { minStreamers: number; games: ThemeGame[] };

type One<T> = T | T[] | null;
const first = <T,>(v: One<T>): T | null => (Array.isArray(v) ? v[0] ?? null : v);
type Row = {
  video_id: string; is_short: boolean; published_at: string;
  streamer_channels: One<{ streamer_name: string }>;
  games: One<{ id: string; name: string; card_image_url: string | null; cover_image_url: string | null; min_players: number | null; max_players: number | null; party_max: number | null; heat_rank: number | null }>;
};

export async function getStreamerTheme(): Promise<StreamerTheme | null> {
  const rows: Row[] = [];
  for (let from = 0; from < 10000; from += 1000) {
    const { data, error } = await supabase
      .from('streamer_videos')
      .select('video_id, is_short, published_at, streamer_channels(streamer_name), games!inner(id, name, card_image_url, cover_image_url, min_players, max_players, party_max, heat_rank)')
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
  for (const k of THRESHOLDS) {
    const picked = all.filter((g) => g.streamers.length >= k);
    if (picked.length >= THEME_MIN || k === THRESHOLDS[THRESHOLDS.length - 1]) {
      picked.sort((a, b) => b.streamers.length - a.streamers.length || a.rank - b.rank);
      return { minStreamers: k, games: picked.slice(0, THEME_MAX).map(({ rank, short, ...g }) => g) };
    }
  }
  return null;
}
