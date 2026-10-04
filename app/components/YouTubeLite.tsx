'use client';

import { useEffect, useRef, useState, type CSSProperties, type SyntheticEvent } from 'react';
import GameImage from './GameImage';

// embed/ID, watch?v=ID, youtu.be/ID, shorts/ID 모두 처리
function getVideoId(url: string | null): string | null {
  if (!url) return null;
  const m = url.match(/(?:embed\/|watch\?v=|youtu\.be\/|shorts\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

// 썸네일: 기본은 hqdefault(480×360, 약 15~30KB). 카드가 640px 넘게 보일 때만 maxresdefault(1280×720) — <picture>로 화면 너비에 따라 고른다
// wide: 페이지 폭을 다 쓰는 카드(상세 맨 위 트레일러). .page 좌우 여백 24px씩이라 화면 689px부터 카드가 640px를 넘음
//   탭 목록(.coop-videos)은 넓은 화면 3열·좁은 화면 78%라 640px를 넘지 않음 → wide 없이 hqdefault만
// maxresdefault가 없는 영상은 오류 대신 120×90 회색 이미지가 오므로, 로드 후 폭이 120 이하면 hqdefault로 바꾼다
// 4:3 위아래 검은 띠는 16:9 상자에서 object-fit: cover로 잘려 나감
const WIDE_MEDIA = '(min-width: 689px)';

export default function YouTubeLite({ url, title, fallbackImage, wide = false, fetchPriority }: { url: string | null; title: string; fallbackImage?: string; wide?: boolean; fetchPriority?: 'high' | 'low' | 'auto' }) {
  const [playing, setPlaying] = useState(false);
  const [thumbFailed, setThumbFailed] = useState(false);
  const [noMaxres, setNoMaxres] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const id = getVideoId(url);

  // 120px 이하 = 유튜브 회색 대체 이미지. maxres였으면 hqdefault로, hqdefault도 그렇다면 삭제된 영상 → 사진으로 대신
  const checkThumb = (img: HTMLImageElement) => {
    if (img.naturalWidth > 120) return;
    if (img.currentSrc.includes('/maxresdefault.jpg')) setNoMaxres(true);
    else setThumbFailed(true);
  };
  // 서버에서 그린 이미지가 화면 준비(hydration) 전에 다 받아졌으면 onLoad·onError가 안 불리므로 한 번 더 확인
  useEffect(() => {
    const img = imgRef.current;
    if (!img?.complete) return;
    if (img.naturalWidth === 0) setThumbFailed(true);
    else checkThumb(img);
  }, [id, noMaxres]);

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
      <picture>
        {wide && !noMaxres && <source media={WIDE_MEDIA} srcSet={`https://i.ytimg.com/vi/${id}/maxresdefault.jpg`} />}
        <img
          ref={imgRef}
          src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`}
          alt={title}
          fetchPriority={fetchPriority}
          onError={(e: SyntheticEvent<HTMLImageElement>) => {
            // maxres 요청이 아예 실패하면 hqdefault로 한 번 더, hqdefault도 실패면 사진으로
            if (e.currentTarget.currentSrc.includes('/maxresdefault.jpg')) setNoMaxres(true);
            else failThumb();
          }}
          onLoad={(e) => checkThumb(e.currentTarget)}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      </picture>
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
