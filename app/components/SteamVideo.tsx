'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import GameImage from './GameImage';

// 스팀 상점 공식 트레일러(HLS .m3u8) 재생. 스팀은 이제 mp4 없이 HLS·DASH만 줌
// - 처음엔 게임 사진 + 재생 버튼만 (영상 파일은 누를 때 받음)
// - 사파리·최신 크롬처럼 HLS를 바로 트는 브라우저는 <video>로, 아니면 hls.js를 그때 불러서 재생
// - 영상을 못 불러오면(스팀이 주소를 바꾼 경우 등) 사진으로 대신
// 이 컴포넌트를 쓸지는 app/lib/steamVideo.ts의 isSteamVideo로 고른다

export default function SteamVideo({ url, title, fallbackImage, fetchPriority }: { url: string; title: string; fallbackImage?: string; fetchPriority?: 'high' | 'low' | 'auto' }) {
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!playing || !video) return;
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = url;
      video.play().catch(() => {});
      return;
    }
    let hls: { destroy: () => void } | null = null;
    let cancelled = false;
    import('hls.js').then(({ default: Hls }) => {
      if (cancelled) return;
      if (!Hls.isSupported()) return setFailed(true);
      const h = new Hls();
      hls = h;
      h.on(Hls.Events.ERROR, (_e, data) => { if (data.fatal) setFailed(true); });
      h.loadSource(url);
      h.attachMedia(video);
      h.on(Hls.Events.MANIFEST_PARSED, () => { video.play().catch(() => {}); });
    }).catch(() => setFailed(true));
    return () => { cancelled = true; hls?.destroy(); };
  }, [playing, url]);

  const box: CSSProperties = {
    position: 'relative', width: '100%', aspectRatio: '16/9',
    borderRadius: 12, overflow: 'hidden', background: '#000',
  };

  if (failed) {
    return fallbackImage
      ? <GameImage src={fallbackImage} fallbackWidth={1280} alt={title} style={{ width: '100%', display: 'block', borderRadius: 12 }} />
      : null;
  }

  if (playing) {
    return (
      <div style={box}>
        <video
          ref={videoRef}
          title={title}
          controls
          playsInline
          onError={() => setFailed(true)}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setPlaying(true)}
      aria-label={`${title} 재생`}
      style={{ ...box, display: 'block', padding: 0, border: 'none', cursor: 'pointer' }}
    >
      {fallbackImage && (
        <GameImage src={fallbackImage} fallbackWidth={1280} alt={title} fetchPriority={fetchPriority} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      )}
      <span
        style={{
          position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          width: 64, height: 64, borderRadius: '50%', background: 'rgba(0,0,0,0.65)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <span style={{ width: 0, height: 0, borderLeft: '20px solid #fff', borderTop: '12px solid transparent', borderBottom: '12px solid transparent', marginLeft: 5 }} />
      </span>
    </button>
  );
}
