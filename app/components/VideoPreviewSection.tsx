'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import GdSection from './detail/GdSection';
import type { VideoItem } from '../lib/videoList';

// 상세 주소 끝에 붙는 해시 — 메인 "스트리머가 플레이한 게임" 카드가 이 섹션으로 바로 보냄
const VIDEOS_ANCHOR = 'streamer-videos';
const SHOWN = 6; // 3열 × 2줄

// 12345 → 1.2만, 123456 → 12만, 123456789 → 1.2억
function formatViews(n: number) {
  if (n >= 1e8) return `${+(n / 1e8).toFixed(1)}억`;
  if (n >= 1e5) return `${Math.floor(n / 1e4)}만`;
  if (n >= 1e4) return `${+(n / 1e4).toFixed(1)}만`;
  return n.toLocaleString('ko-KR');
}

// 길이 배지 — 65초 → 1:05, 3725초 → 1:02:05
function formatDuration(sec: number) {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

// 채널 · 조회수 한 줄 (값이 있는 것만)
const metaOf = (v: VideoItem) => [v.channel, v.view_count ? `조회수 ${formatViews(v.view_count)}` : ''].filter(Boolean).join(' · ');

// 영상 썸네일 (16:9, 바로 받음 — 삭제된 영상이 페이지를 열자마자 목록에서 빠지게). 삭제된 영상은 유튜브가 120×90 회색 이미지를 주므로 그때 부모에게 알려 목록에서 뺌
function Thumb({ id, onBroken }: { id: string; onBroken: () => void }) {
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
    <img ref={ref} src={`https://i.ytimg.com/vi/${id}/mqdefault.jpg`} alt="" loading="eager" decoding="async" onLoad={(e) => check(e.currentTarget)} onError={onBroken} />
  );
}

// 상세 "인기 동영상" — 3열 썸네일 그리드 (16:9 썸네일 + 길이 배지 + 제목 + 채널·조회수). 누르면 그 자리에서 재생 (새 페이지 이동 없음)
// 목록 순서·자르기는 lib/videoList
export default function VideoPreviewSection({ videos, streamers }: { videos: VideoItem[]; streamers: ReactNode }) /* streamers: 채널 링크 칩 (없으면 null) */ {
  const [broken, setBroken] = useState<ReadonlySet<string>>(new Set());
  const [playingId, setPlayingId] = useState<string | null>(null);
  const markBroken = (id: string) => setBroken((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));

  const list = videos.filter((v) => !broken.has(v.video_id)).slice(0, SHOWN);
  if (!list.length && !streamers) return null;

  return (
    <GdSection title="인기 동영상" id={VIDEOS_ANCHOR}>
      {list.length > 0 && (
        <>
          <ul className="gd-videos">
            {list.map((v) => (
              <li key={v.video_id}>
                {playingId === v.video_id ? (
                  <div className="gd-video">
                    <span className="gd-video-thumb">
                      <iframe
                        src={`https://www.youtube-nocookie.com/embed/${v.video_id}?autoplay=1&rel=0&modestbranding=1&playsinline=1`}
                        title={v.title}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        referrerPolicy="strict-origin-when-cross-origin"
                        allowFullScreen
                      />
                    </span>
                    <span className="gd-video-title">{v.title}</span>
                    {metaOf(v) && <span className="gd-video-meta">{metaOf(v)}</span>}
                  </div>
                ) : (
                  <button type="button" className="gd-video" onClick={() => setPlayingId(v.video_id)} aria-label={`${v.title} 재생`}>
                    <span className="gd-video-thumb">
                      <Thumb id={v.video_id} onBroken={() => markBroken(v.video_id)} />
                      {v.duration_sec ? <span className="gd-video-len">{formatDuration(v.duration_sec)}</span> : null}
                    </span>
                    <span className="gd-video-title">{v.title}</span>
                    {metaOf(v) && <span className="gd-video-meta">{metaOf(v)}</span>}
                  </button>
                )}
              </li>
            ))}
          </ul>
          <p className="gd-note">영상 출처: YouTube</p>
        </>
      )}

      {streamers && (
        <div className={list.length > 0 ? 'gd-streamers has-videos' : 'gd-streamers'}>
          <h3 className="gd-streamers-title">이 게임을 플레이한 채널</h3>
          {streamers}
        </div>
      )}
    </GdSection>
  );
}
