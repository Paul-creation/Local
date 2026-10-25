// 메인 "스트리머들이 밤새운 협동 게임" 섹션 — 선정은 스트리머 영상 표에서 매번 계산한다
// 그래서 매일 도는 fetch-streamer-videos(새 영상 연결)와 관리자 페이지의 숨김·채널 끄기가 따로 작업 없이 바로 반영된다 (페이지는 5분 캐시)
// 조건: 스트리머 영상이 1개 이상 + 친구끼리 최대 인원 2명 이상 + 온라인 협동 또는 로컬 협동이 true (null은 제외) + category가 "협동" 또는 "협동·대전"
// ("대전" 단독·혼자는 제외 — PvP 위주 게임을 거르는 기준. 협동·대전도 위 협동 모드 확인 조건을 통과한 게임만). 개별 제외 목록은 두지 않는다
// 정렬: 플레이한 스트리머 수 → 인기(heat_rank) 순, 조건에 맞는 게임 전부 (6개 미만이면 null = 섹션 숨김)
// excludeIds: 넘기면 그 게임을 후보에서 먼저 빼고 고른다 (빼고 나서 6개 미만이면 중복 제거 없이 원래대로). 메인은 넘기지 않는다 — 가로 스크롤 줄이라 전부 보여준다
import { supabase } from './supabase';
import { friendsMax } from './playersMatch';
import { pickStreamerVideo, type PickRow } from './streamerPick';
import { gameName } from './gameName';

export const THEME_MIN = 6; // 이보다 적으면 섹션을 숨긴다 (null)

export type ThemeGame = {
  id: string;
  name: string;
  streamers: StreamerRef[]; // 최근 영상 순, 사람 기준 중복 없음. 칩마다 대표 영상 하나(videoId)
};
export type StreamerTheme = { games: ThemeGame[] };

// 칩 하나가 연결할 영상 — 고르는 규칙은 lib/streamerPick (main·edit·game 긴 영상 → 쇼츠 → vod, 같은 단계는 최근). full은 vod 영상(칩 aria-label·title에 "(풀영상)")
export type StreamerRef = { name: string; videoId: string; full: boolean };

type One<T> = T | T[] | null;
const first = <T,>(v: One<T>): T | null => (Array.isArray(v) ? v[0] ?? null : v);
type Row = {
  video_id: string; is_short: boolean; published_at: string;
  streamer_channels: One<{ streamer_name: string; kind: string }>;
  games: One<{ id: string; name: string; display_name?: string | null; card_image_url: string | null; cover_image_url: string | null; category: string | null; min_players: number | null; max_players: number | null; party_max: number | null; has_online_coop: boolean | null; has_local_coop: boolean | null; heat_rank: number | null }>;
};

export async function getStreamerTheme(excludeIds: string[] = []): Promise<StreamerTheme | null> {
  const rows: Row[] = [];
  for (let from = 0; from < 10000; from += 1000) {
    const { data, error } = await supabase
      .from('streamer_videos')
      .select('video_id, is_short, published_at, streamer_channels(streamer_name, kind), games!inner(id, name, display_name, card_image_url, cover_image_url, category, min_players, max_players, party_max, has_online_coop, has_local_coop, heat_rank)')
      .eq('games.hidden', false)
      .eq('games.home_excluded', false)
      .neq('games.release_status', 'coming_soon') // 출시 예정 게임은 추천 섹션에 안 나옴
      .order('published_at', { ascending: false })
      .range(from, from + 999);
    if (error) return null;
    rows.push(...((data || []) as unknown as Row[]));
    if (!data || data.length < 1000) break;
  }

  const pick = (skip: Set<string>) => {
    const byGame = new Map<string, ThemeGame & { rank: number; rows: Map<string, PickRow[]> }>();
    for (const r of rows) { // 최근 영상부터 들어온다
      const g = first(r.games);
      if (!g || skip.has(g.id) || (friendsMax(g) ?? 0) < 2) continue;
      if (g.category !== '협동' && g.category !== '협동·대전') continue; // 대전·혼자 제외 (협동·대전은 아래 협동 모드 확인 필수)
      if (g.has_online_coop !== true && g.has_local_coop !== true) continue; // 협동 모드가 확인된 게임만
      let item = byGame.get(g.id);
      if (!item) {
        item = { id: g.id, name: gameName(g), streamers: [], rank: g.heat_rank ?? Infinity, rows: new Map() };
        byGame.set(g.id, item);
      }
      const ch = first(r.streamer_channels);
      if (!ch?.streamer_name) continue;
      const list = item.rows.get(ch.streamer_name);
      const row = { video_id: r.video_id, kind: ch.kind, is_short: r.is_short };
      if (list) list.push(row);
      else item.rows.set(ch.streamer_name, [row]); // 맵 순서 = 이름이 처음 나온(최근 영상) 순
    }

    const all = [...byGame.values()].map(({ rows: byName, ...g }) => ({
      ...g,
      streamers: [...byName].flatMap(([name, list]) => { const v = pickStreamerVideo(list); return v ? [{ name, ...v }] : []; }),
    })).filter((g) => g.streamers.length > 0); // 연결할 영상이 있는 게임만 (썸네일·링크가 영상)
    all.sort((a, b) => b.streamers.length - a.streamers.length || a.rank - b.rank);
    if (all.length < THEME_MIN) return null;
    return { games: all.map(({ rank, ...g }) => { void rank; return g; }) };
  };
  const skip = new Set(excludeIds);
  return (skip.size > 0 ? pick(skip) : null) ?? pick(new Set());
}
