// 스트리머 영상 — 지금 뜨는 게임 카드·순위 줄의 스트리머 배지 데이터 (메인 협동 기획전은 lib/streamerTheme)
// 켜진 채널의 숨기지 않은 영상만 anon으로 읽힘 (RLS: supabase/migrations/20261014090000_streamer_videos.sql)
import { supabase } from './supabase';

type One<T> = T | T[] | null; // 연결된 표가 객체로 오든 배열로 오든 처리
const first = <T,>(v: One<T>): T | null => (Array.isArray(v) ? v[0] ?? null : v);

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
