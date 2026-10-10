// 상세 "영상으로 미리 보기" 목록 만들기 (순수 함수 — 테스트가 .ts를 바로 불러온다, 다른 파일을 import하지 않는다)
// 순서: 친구랑 플레이(조회수순) → 하이라이트 → 스트리머 일반(tier 1, 최근순) → 쇼츠(tier 2) → vod(tier 3, 최근순)
// tier는 호출하는 쪽이 lib/streamerPick의 tierOf로 계산해서 넘긴다
// 자르기: 같은 video_id는 앞에 온 것 하나만, 친구랑 플레이 최대 3개, 하이라이트 최대 2개, 스트리머 1명당 최대 2개, vod는 전체 최대 2개, 전체 최대 8개 (스트리머 영상 자리 3개 확보)
export type VideoInput =
  | { source: 'coop'; video_id: string; title: string; channel_title: string | null; published_at: string | null; view_count: number | null }
  | { source: 'highlight'; video_id: string; title: string; channel_title: string | null; published_at: string | null; view_count: number | null }
  | { source: 'streamer'; video_id: string; title: string; streamer_name: string; tier: 1 | 2 | 3; published_at: string | null; view_count: number | null };

export type VideoItem = { video_id: string; title: string; label: string; published_at: string | null; view_count: number | null };

export const MAX_VIDEOS = 8;
export const MAX_COOP = 3;
export const MAX_HIGHLIGHT = 2;
export const MAX_PER_STREAMER = 2;
export const MAX_VOD = 2;

const time = (v: string | null) => (v ? Date.parse(v) || 0 : 0);
const views = (v: { view_count: number | null }) => v.view_count ?? 0;

export function labelOf(v: VideoInput): string {
  if (v.source === 'coop') return v.channel_title ? `멀티 플레이 · ${v.channel_title}` : '멀티 플레이';
  if (v.source === 'highlight') return '하이라이트';
  return `스트리머 · ${v.streamer_name}${v.tier === 3 ? ' · 풀영상' : v.tier === 2 ? ' · 쇼츠' : ''}`;
}

export function buildVideoList(inputs: VideoInput[]): VideoItem[] {
  const coop = inputs.filter((v) => v.source === 'coop').sort((a, b) => views(b) - views(a)).slice(0, MAX_COOP);
  const highlight = inputs.filter((v) => v.source === 'highlight').sort((a, b) => views(b) - views(a)).slice(0, MAX_HIGHLIGHT);
  const streamer = inputs
    .filter((v): v is Extract<VideoInput, { source: 'streamer' }> => v.source === 'streamer')
    .sort((a, b) => a.tier - b.tier || time(b.published_at) - time(a.published_at));

  const seen = new Set<string>();
  const perStreamer = new Map<string, number>();
  let vod = 0;
  const out: VideoItem[] = [];
  for (const v of [...coop, ...highlight, ...streamer]) {
    if (out.length >= MAX_VIDEOS) break;
    if (seen.has(v.video_id)) continue;
    if (v.source === 'streamer') {
      if ((perStreamer.get(v.streamer_name) ?? 0) >= MAX_PER_STREAMER) continue;
      if (v.tier === 3 && vod >= MAX_VOD) continue;
      perStreamer.set(v.streamer_name, (perStreamer.get(v.streamer_name) ?? 0) + 1);
      if (v.tier === 3) vod++;
    }
    seen.add(v.video_id);
    out.push({ video_id: v.video_id, title: v.title, label: labelOf(v), published_at: v.published_at, view_count: v.view_count });
  }
  return out;
}
