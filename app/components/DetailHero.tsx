'use client';

import { useState, type ReactNode } from 'react';
import GameImage from './GameImage';
import YouTubeLite from './YouTubeLite';
import SteamVideo from './SteamVideo';
import { isSteamVideo } from '../lib/steamVideo';

// 상세 맨 위 — 넓은 아트워크(잘림 없이 contain + 같은 이미지를 흐리게 깐 배경), 아래 55%가 배경색으로 어두워지는 그라데이션,
// 가운데 "트레일러 재생"(영상이 있을 때), 왼쪽 아래 뱃지 + 제목. 재생을 누르면 그 자리에서 영상이 바로 재생되고 제목은 아래로
export default function DetailHero({ image, videoUrl, name, badges, meta }: { image: string | null; videoUrl: string | null; name: string; badges: ReactNode; meta?: ReactNode }) {
  const [playing, setPlaying] = useState(false);
  const title = `${name} 트레일러`;

  const info = (
    <div className="dh-info">
      <div className="dh-badges">{badges}</div>
      <h1 className="dh-title">{name}</h1>
      {meta && <div className="dh-meta">{meta}</div>}
    </div>
  );

  if (playing && videoUrl) {
    return (
      <div className="dh is-playing">
        {image && <span className="dh-ambient" aria-hidden="true"><GameImage src={image} fallbackWidth={1280} alt="" /></span>}
        <div className="dh-player">
          {isSteamVideo(videoUrl)
            ? <SteamVideo url={videoUrl} title={title} fallbackImage={image || undefined} autoPlay />
            : <YouTubeLite url={videoUrl} title={title} fallbackImage={image || undefined} wide autoPlay />}
        </div>
        {info}
      </div>
    );
  }

  return (
    <div className="dh">
      {/* 페이지 위쪽 배경에 같은 이미지를 크게 흐리게 — 게임 색이 배어 나오고 아래로 갈수록 배경색으로 사라짐 (같은 주소라 새로 받지 않음) */}
      {image && <span className="dh-ambient" aria-hidden="true"><GameImage src={image} fallbackWidth={1280} alt="" /></span>}
      <div className="dh-media">
        {image && <GameImage src={image} fallbackWidth={1280} alt="" aria-hidden="true" className="dh-backdrop" />}
        {image && <GameImage src={image} fallbackWidth={1280} alt={name} fetchPriority="high" className="dh-art" />}
        <span className="dh-shade" aria-hidden="true" />
        {videoUrl && (
          <button type="button" className="dh-play" onClick={() => setPlaying(true)} aria-label={`${title} 재생`}>
            트레일러 재생
          </button>
        )}
      </div>
      {info}
    </div>
  );
}
