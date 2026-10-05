// 스트리머 영상 — 메인 "스트리머가 플레이한 게임" 줄 데이터
// 켜진 채널의 숨기지 않은 영상만 anon으로 읽힘 (RLS: supabase/migrations/20261014090000_streamer_videos.sql)
import { supabase } from './supabase';

export type StreamerGame = {
  id: string;
  name: string;
  image: string | null;
  streamers: number; // 영상을 올린 서로 다른 스트리머 수 (채널이 아니라 사람 기준)
};

type One<T> = T | T[] | null; // 연결된 표가 객체로 오든 배열로 오든 처리
type Row = {
  published_at: string;
  streamer_channels: One<{ streamer_name: string }>;
  games: One<{ id: string; name: string; card_image_url: string | null; cover_image_url: string | null }>;
};
const first = <T,>(v: One<T>): T | null => (Array.isArray(v) ? v[0] ?? null : v);

export const STREAMER_HOME_LIMIT = 12;

// 최근 영상부터 한 번에 읽어 게임별로 묶는다 (게임마다 따로 요청하지 않음)
// 게임별 최신 영상 순으로 최대 12개. 숨긴 게임·메인 노출 제외 게임은 games!inner 조건으로 뺀다
export async function getStreamerGames(): Promise<StreamerGame[]> {
  const { data, error } = await supabase
    .from('streamer_videos')
    .select('game_id, published_at, streamer_channels(streamer_name), games!inner(id, name, card_image_url, cover_image_url)')
    .eq('games.hidden', false)
    .eq('games.home_excluded', false)
    .order('published_at', { ascending: false })
    .limit(1000);
  if (error || !data) return [];

  const byGame = new Map<string, StreamerGame & { names: Set<string> }>();
  for (const row of data as unknown as Row[]) {
    const g = first(row.games);
    const c = first(row.streamer_channels);
    if (!g) continue;
    let item = byGame.get(g.id); // Map은 넣은 순서 유지 → 최근 영상이 먼저 나온 게임 순
    if (!item) {
      item = { id: g.id, name: g.name, image: g.card_image_url || g.cover_image_url || null, streamers: 0, names: new Set() };
      byGame.set(g.id, item);
    }
    if (c?.streamer_name) item.names.add(c.streamer_name);
  }
  return [...byGame.values()]
    .slice(0, STREAMER_HOME_LIMIT)
    .map(({ names, ...g }) => ({ ...g, streamers: names.size }));
}

// 지금 뜨는 게임 카드·순위 줄 배지용 — 보여줄 게임들의 스트리머 이름을 한 번에 읽는다 (게임마다 따로 요청하지 않음)
// 게임별로 최근 영상을 올린 스트리머 순, 사람 기준으로 중복 없이. 영상이 없는 게임은 빈 배열
export async function getStreamerNamesByGame(gameIds: string[]): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  if (!gameIds.length) return out;
  const { data, error } = await supabase
    .from('streamer_videos')
    .select('game_id, published_at, streamer_channels(streamer_name)')
    .in('game_id', gameIds)
    .order('published_at', { ascending: false })
    .limit(1000);
  if (error || !data) return out;
  for (const row of data as unknown as { game_id: string; streamer_channels: One<{ streamer_name: string }> }[]) {
    const name = first(row.streamer_channels)?.streamer_name;
    if (!name) continue;
    const list = out.get(row.game_id) ?? [];
    if (!list.includes(name)) list.push(name);
    out.set(row.game_id, list);
  }
  return out;
}
