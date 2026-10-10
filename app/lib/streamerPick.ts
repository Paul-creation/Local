// 스트리머 칩이 연결할 대표 영상 고르기 (순수 함수 — 테스트가 .ts를 바로 불러온다, 다른 파일을 import하지 않는다)
// 그 게임에서 그 스트리머의 영상(최근 영상이 앞) 중
//   (1) main·edit·game 채널의 쇼츠 아닌 영상 → (2) 같은 채널의 쇼츠 → (3) 다시보기(vod) 채널 영상, 같은 단계 안에서는 최근 영상
// full은 (3)단계 — 칩의 aria-label·title에 "(풀영상)"을 붙인다
export type PickRow = { video_id: string; kind: string | undefined; is_short: boolean };
export type PickedVideo = { videoId: string; full: boolean };

export const tierOf = (kind: string | undefined, isShort: boolean): 1 | 2 | 3 => (kind === 'vod' ? 3 : isShort ? 2 : 1);

export function pickStreamerVideo(rows: PickRow[]): PickedVideo | null {
  let best: { row: PickRow; tier: number } | null = null;
  for (const row of rows) {
    const tier = tierOf(row.kind, row.is_short);
    if (!best || tier < best.tier) best = { row, tier }; // 같은 단계에서는 먼저 온(최근) 것이 남는다
  }
  return best ? { videoId: best.row.video_id, full: best.tier === 3 } : null;
}
