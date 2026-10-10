'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import YouTubeLite from './YouTubeLite';
import { formatDate } from '../lib/date';
import type { VideoItem } from '../lib/videoList';

// 상세 주소 끝에 붙는 해시 — 메인 "스트리머가 플레이한 게임" 카드가 이 섹션으로 바로 보냄
const VIDEOS_ANCHOR = 'streamer-videos';

// 12345 → 1.2만, 123456 → 12만, 123456789 → 1.2억
function formatViews(n: number) {
  if (n >= 1e8) return `${+(n / 1e8).toFixed(1)}억`;
  if (n >= 1e5) return `${Math.floor(n / 1e4)}만`;
  if (n >= 1e4) return `${+(n / 1e4).toFixed(1)}만`;
  return n.toLocaleString('ko-KR');
}

const metaOf = (v: VideoItem) => [v.view_count ? `조회수 ${formatViews(v.view_count)}` : '', formatDate(v.published_at)].filter(Boolean).join(' · ');

// 목록의 작은 썸네일 (16:9, 320×180). 삭제된 영상은 유튜브가 120×90 회색 이미지를 주므로 그때 부모에게 알려 목록에서 뺌
function RailThumb({ id, onBroken }: { id: string; onBroken: () => void }) {
  const ref = useRef<HTMLImageElement>(null);
  const check = (img: HTMLImageElement) => {
    if (img.naturalWidth <= 120) onBroken();
  };
  useEffect(() => {
    const img = ref.current;
    if (img?.complete) check(img); // 서버에서 그린 이미지가 hydration 전에 다 받아진 경우
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img ref={ref} src={`https://i.ytimg.com/vi/${id}/mqdefault.jpg`} alt="" loading="lazy" onLoad={(e) => check(e.currentTarget)} onError={onBroken} />
  );
}

// 상세 페이지 "영상으로 미리 보기" — 섹션 폭 전체 16:9 메인 플레이어 1개 + 아래 작은 썸네일 목록
// 처음엔 목록 첫 영상이 썸네일 상태로 떠 있고, 목록의 썸네일을 누르면 메인이 그 영상으로 바뀌어 바로 재생됨 (새 페이지 이동 없음)
// 목록 순서·자르기는 lib/videoList, 출처 문구(label)도 거기서 만듦
export default function VideoPreviewSection({ videos, streamers }: { videos: VideoItem[]; streamers: ReactNode }) /* streamers: 채널 링크 칩 (없으면 null) */ {
  const [broken, setBroken] = useState<ReadonlySet<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [picks, setPicks] = useState(0); // 썸네일을 누른 횟수 — 0이면 아직 사용자가 고른 적 없음(자동 재생 안 함). 같은 영상을 다시 눌러도 플레이어를 새로 그려 재생
  const markBroken = (id: string) => setBroken((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));

  const list = videos.filter((v) => !broken.has(v.video_id));
  if (!list.length && !streamers) return null;
  const current = list.find((v) => v.video_id === selectedId) ?? list[0];

  return (
    <section className="detail-card" id={VIDEOS_ANCHOR}>
      <h3 className="detail-card-title">영상으로 미리 보기</h3>

      {current && (
        <>
          <div className="video-stage">
            <YouTubeLite
              key={`${current.video_id}:${picks}`}
              url={`https://www.youtube.com/embed/${current.video_id}`}
              title={current.title}
              wide
              autoPlay={picks > 0}
              onBroken={() => markBroken(current.video_id)}
            />
          </div>
          <div className="video-stage-info">
            <div className="video-stage-title">{current.title}</div>
            <div className="video-stage-sub">
              <span className="chip is-static">{current.label}</span>
              {metaOf(current) && <span className="coop-video-meta">{metaOf(current)}</span>}
            </div>
          </div>

          {list.length > 1 && (
            <ul className="video-rail" aria-label="다른 영상">
              {list.map((v) => (
                <li key={v.video_id} className="video-rail-item">
                  <button
                    type="button"
                    className="video-rail-btn"
                    aria-current={v.video_id === current.video_id ? 'true' : undefined}
                    onClick={() => { setSelectedId(v.video_id); setPicks((n) => n + 1); }}
                  >
                    <span className="video-rail-thumb"><RailThumb id={v.video_id} onBroken={() => markBroken(v.video_id)} /></span>
                    <span className="coop-video-title">{v.title}</span>
                    <span className="chip is-static video-rail-chip">{v.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="video-source">영상 출처: YouTube</p>
        </>
      )}

      {streamers && (
        <div className={current ? 'streamer-channels has-videos' : 'streamer-channels'}>
          <h4 className="streamer-sub">이 게임을 플레이한 채널</h4>
          {streamers}
        </div>
      )}
    </section>
  );
}
