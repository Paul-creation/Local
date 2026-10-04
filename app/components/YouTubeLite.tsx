'use client';

import { useState, type CSSProperties } from 'react';
import GameImage from './GameImage';

// embed/ID, watch?v=ID, youtu.be/ID, shorts/ID 모두 처리
function getVideoId(url: string | null): string | null {
  if (!url) return null;
  const m = url.match(/(?:embed\/|watch\?v=|youtu\.be\/|shorts\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

// 썸네일은 hqdefault(480×360, 약 15~30KB) 하나만 — maxres(1280×720)는 100KB 넘기도 하고 없는 영상이 많아 요청이 여러 번 생김.
// 4:3 위아래 검은 띠는 16:9 상자에서 object-fit: cover로 잘려 나감

export default function YouTubeLite({ url, title, fallbackImage }: { url: string | null; title: string; fallbackImage?: string }) {
  const [playing, setPlaying] = useState(false);
  const [thumbFailed, setThumbFailed] = useState(false);
  const id = getVideoId(url);
  // 영상이 없거나 삭제됐으면 사진으로 대신 (사진도 없으면 아무것도 안 보여줌)
  if (!id || thumbFailed) {
    return fallbackImage
      ? <GameImage src={fallbackImage} fallbackWidth={1280} alt={title} style={{ width: '100%', display: 'block', borderRadius: 12 }} />
      : null;
  }

  const failThumb = () => setThumbFailed(true);

  const box: CSSProperties = {
    position: 'relative', width: '100%', aspectRatio: '16/9',
    borderRadius: 12, overflow: 'hidden', background: '#000',
  };

  if (playing) {
    return (
      <div style={box}>
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&modestbranding=1&playsinline=1`}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
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
      <img
        src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`}
        alt={title}
        onError={failThumb}
        onLoad={(e) => {
          // 삭제된 영상이면 120px짜리 회색 대체 이미지가 옴 → 사진으로 대신
          if (e.currentTarget.naturalWidth <= 120) failThumb();
        }}
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
      />
      <span
        style={{
          position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          width: 68, height: 48, borderRadius: 12, background: 'rgba(255,0,0,0.9)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <span style={{ width: 0, height: 0, borderLeft: '18px solid #fff', borderTop: '11px solid transparent', borderBottom: '11px solid transparent', marginLeft: 4 }} />
      </span>
    </button>
  );
}
