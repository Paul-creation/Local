'use client';

import { useState, type ReactNode } from 'react';
import YouTubeLite from './YouTubeLite';

export type CoopVideo = {
  video_id: string;
  title: string;
  channel_title: string | null;
  published_at: string | null;
  view_count: number | null;
};

// 12345 → 1.2만, 123456 → 12만, 123456789 → 1.2억
function formatViews(n: number) {
  if (n >= 1e8) return `${+(n / 1e8).toFixed(1)}억`;
  if (n >= 1e5) return `${Math.floor(n / 1e4)}만`;
  if (n >= 1e4) return `${+(n / 1e4).toFixed(1)}만`;
  return n.toLocaleString('ko-KR');
}

function formatMonth(iso: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getFullYear()}.${d.getMonth() + 1}`;
}

// 상세 페이지 "영상으로 미리 보기" — [친구랑 하는 영상] [스트리머] 탭. 내용이 없는 탭은 숨김
export default function VideoPreviewSection({ videos, streamers }: { videos: CoopVideo[]; streamers: ReactNode }) {
  const tabs = [
    videos.length > 0 && { key: 'coop', label: '친구랑 하는 영상' },
    streamers && { key: 'streamers', label: '스트리머' },
  ].filter(Boolean) as { key: string; label: string }[];
  const [tab, setTab] = useState(tabs[0]?.key);
  if (!tabs.length) return null;

  return (
    <section className="detail-section-v2">
      <h3>영상으로 미리 보기</h3>
      <div className="video-tabs" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            className={`video-tab${tab === t.key ? ' is-active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'coop' && (
        <>
          <div className="coop-videos" role="tabpanel">
            {videos.map((v) => (
              <div key={v.video_id} className="coop-video-card">
                <YouTubeLite url={`https://www.youtube.com/embed/${v.video_id}`} title={v.title} />
                <div className="coop-video-title">{v.title}</div>
                <div className="coop-video-channel">{v.channel_title}</div>
                <div className="coop-video-meta">
                  {[v.view_count ? `조회수 ${formatViews(v.view_count)}` : '', formatMonth(v.published_at)].filter(Boolean).join(' · ')}
                </div>
              </div>
            ))}
          </div>
          <p className="video-source">영상 출처: YouTube</p>
        </>
      )}
      {tab === 'streamers' && <div role="tabpanel">{streamers}</div>}
    </section>
  );
}
