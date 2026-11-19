'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import GameImage from '../GameImage';
import YouTubeLite from '../YouTubeLite';
import SteamVideo from '../SteamVideo';
import { isSteamVideo } from '../../lib/steamVideo';

export type Screenshot = { path_thumbnail: string; path_full: string };

// 상세 "트레일러·스크린샷" — 3칸 줄(트레일러 2fr + 스크린샷 1fr 1fr, 트레일러가 없으면 스크린샷 3칸). 칸은 모두 16:9, 반경 8
// 아래 줄: "스크린샷 N장" + 다음 버튼(› 누르면 다음 장들로, 끝이면 처음으로). 스크린샷을 누르면 큰 사진 라이트박스, 트레일러 재생을 누르면 그 칸에서 재생
// next/image를 쓰지 않고 일반 img를 쓴다 (Vercel 이미지 최적화 사용량을 늘리지 않으려고)
export default function DetailMedia({ image, videoUrl, shots, name }: { image: string | null; videoUrl: string | null; shots: Screenshot[]; name: string }) {
  const [playing, setPlaying] = useState(false);
  const [start, setStart] = useState(0);
  const [open, setOpen] = useState<number | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const lastFocus = useRef<HTMLElement | null>(null);
  const count = shots.length;
  const perView = videoUrl ? 2 : 3;
  const isOpen = open != null;
  const title = `${name} 트레일러`;

  const move = useCallback((d: number) => setOpen((i) => (i == null ? i : (i + d + count) % count)), [count]);
  const close = useCallback(() => setOpen(null), []);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowLeft') move(-1);
      else if (e.key === 'ArrowRight') move(1);
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    closeRef.current?.focus();
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      lastFocus.current?.focus();
    };
  }, [isOpen, close, move]);

  const visible = Array.from({ length: Math.min(perView, count) }, (_, k) => (start + k) % count);

  return (
    <>
      <div className={`gd-media${videoUrl ? '' : ' no-video'}`}>
        {videoUrl && (playing ? (
          <div className="gd-media-player">
            {isSteamVideo(videoUrl)
              ? <SteamVideo url={videoUrl} title={title} fallbackImage={image || undefined} autoPlay />
              : <YouTubeLite url={videoUrl} title={title} fallbackImage={image || undefined} wide autoPlay />}
          </div>
        ) : (
          <button type="button" className="gd-media-trailer" onClick={() => setPlaying(true)} aria-label={`${title} 재생`}>
            {image && <GameImage src={image} fallbackWidth={1280} alt="" />}
            <span className="gd-media-play"><span aria-hidden="true">▶</span>트레일러 재생</span>
          </button>
        ))}
        {visible.map((i) => (
          <button
            key={shots[i].path_thumbnail}
            type="button"
            className="gd-media-shot"
            onClick={(e) => { lastFocus.current = e.currentTarget; setOpen(i); }}
            aria-label={`${name} 스크린샷 ${i + 1} 크게 보기`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={shots[i].path_thumbnail} alt="" loading="lazy" decoding="async" />
          </button>
        ))}
      </div>

      {count > 0 && (
        <div className="gd-media-bar">
          <span>스크린샷 {count}장</span>
          {count > perView && (
            <button type="button" className="gd-media-next" aria-label="다음 스크린샷" onClick={() => setStart((s) => (s + perView >= count ? 0 : s + perView))}>›</button>
          )}
        </div>
      )}

      {open != null && (
        <div className="shots-lightbox" role="dialog" aria-modal="true" aria-label={`${name} 스크린샷`} onClick={close}>
          <div className="shots-stage">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={shots[open].path_full} alt={`${name} 스크린샷 ${open + 1}`} onClick={(e) => e.stopPropagation()} />
          </div>
          <div className="shots-bar" onClick={(e) => e.stopPropagation()}>
            {count > 1 && <button type="button" className="shots-btn" onClick={() => move(-1)} aria-label="이전 사진">‹</button>}
            <span className="shots-count num">{open + 1} / {count}</span>
            {count > 1 && <button type="button" className="shots-btn" onClick={() => move(1)} aria-label="다음 사진">›</button>}
            <button type="button" ref={closeRef} className="shots-btn shots-close" onClick={close}>닫기</button>
          </div>
        </div>
      )}
    </>
  );
}
