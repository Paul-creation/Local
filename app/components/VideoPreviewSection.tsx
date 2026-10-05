'use client';

import { useEffect, useState, type ReactNode } from 'react';
import YouTubeLite from './YouTubeLite';
import { formatDate, formatYearMonth } from '../lib/date';

export type CoopVideo = {
  video_id: string;
  title: string;
  channel_title: string | null;
  published_at: string | null;
  view_count: number | null;
};

export type StreamerVideo = {
  video_id: string;
  title: string;
  channel_title: string | null;
  published_at: string | null;
};

// 상세 주소 끝에 붙는 해시 — 메인 "스트리머가 플레이한 게임" 카드가 이 탭으로 바로 보냄
const STREAMER_VIDEOS_HASH = 'streamer-videos';

// 12345 → 1.2만, 123456 → 12만, 123456789 → 1.2억
function formatViews(n: number) {
  if (n >= 1e8) return `${+(n / 1e8).toFixed(1)}억`;
  if (n >= 1e5) return `${Math.floor(n / 1e4)}만`;
  if (n >= 1e4) return `${+(n / 1e4).toFixed(1)}만`;
  return n.toLocaleString('ko-KR');
}

function VideoCards({ videos }: { videos: CoopVideo[] }) {
  return (
    <>
      <div className="coop-videos" role="tabpanel">
        {videos.map((v) => (
          <div key={v.video_id} className="coop-video-card">
            <YouTubeLite url={`https://www.youtube.com/embed/${v.video_id}`} title={v.title} />
            <div className="coop-video-title">{v.title}</div>
            <div className="coop-video-channel">{v.channel_title}</div>
            <div className="coop-video-meta">
              {[v.view_count ? `조회수 ${formatViews(v.view_count)}` : '', formatYearMonth(v.published_at)].filter(Boolean).join(' · ')}
            </div>
          </div>
        ))}
      </div>
      <p className="video-source">영상 출처: YouTube</p>
    </>
  );
}

// 스트리머 영상 — 썸네일만 먼저 그리고, 누르면 그 자리에서 youtube-nocookie iframe으로 바뀜 (YouTubeLite). 공식 트레일러와는 별도 탭
function StreamerVideoCards({ videos }: { videos: StreamerVideo[] }) {
  return (
    <>
      <div className="coop-videos" role="tabpanel">
        {videos.map((v) => (
          <div key={v.video_id} className="coop-video-card">
            <YouTubeLite url={`https://www.youtube.com/embed/${v.video_id}`} title={v.title} />
            <div className="coop-video-title">{v.title}</div>
            <div className="coop-video-channel">{v.channel_title}</div>
            <div className="coop-video-meta">{formatDate(v.published_at)}</div>
          </div>
        ))}
      </div>
      <p className="video-source">영상 출처: YouTube</p>
    </>
  );
}

// 상세 페이지 "영상으로 미리 보기" — [하이라이트] [친구랑 플레이] [스트리머](켜진 스트리머 영상) [스트리머 채널](예전 채널 목록) 탭
// 내용이 없는 탭은 숨기고, 첫 탭이 기본
export default function VideoPreviewSection({ highlights, videos, streamerVideos, streamers }: { highlights: CoopVideo[]; videos: CoopVideo[]; streamerVideos: StreamerVideo[]; streamers: ReactNode }) {
  const tabs = [
    highlights.length > 0 && { key: 'highlight', label: '하이라이트' },
    videos.length > 0 && { key: 'coop', label: '친구랑 플레이' },
    streamerVideos.length > 0 && { key: STREAMER_VIDEOS_HASH, label: '스트리머' },
    streamers && { key: 'streamers', label: '스트리머 채널' },
  ].filter(Boolean) as { key: string; label: string }[];
  const [tab, setTab] = useState(tabs[0]?.key);
  // #streamer-videos 로 들어오면 그 탭을 연다 (탭이 없는 게임이면 무시)
  useEffect(() => {
    const open = () => {
      if (location.hash === `#${STREAMER_VIDEOS_HASH}` && streamerVideos.length > 0) setTab(STREAMER_VIDEOS_HASH);
    };
    open();
    window.addEventListener('hashchange', open);
    return () => window.removeEventListener('hashchange', open);
  }, [streamerVideos.length]);
  if (!tabs.length) return null;

  return (
    <section className="detail-card" id={STREAMER_VIDEOS_HASH}>
      <h3 className="detail-card-title">영상으로 미리 보기</h3>
      <div className="tabs video-tabs" role="tablist" aria-label="영상 종류">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            className={`tab${tab === t.key ? ' is-active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'highlight' && <VideoCards videos={highlights} />}
      {tab === 'coop' && <VideoCards videos={videos} />}
      {tab === STREAMER_VIDEOS_HASH && <StreamerVideoCards videos={streamerVideos} />}
      {tab === 'streamers' && <div role="tabpanel">{streamers}</div>}
    </section>
  );
}
