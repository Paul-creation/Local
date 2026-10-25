'use client';

import { useState } from 'react';
import GameImage from '../GameImage';
import YouTubeLite from '../YouTubeLite';
import SteamVideo from '../SteamVideo';
import { isSteamVideo } from '../../lib/steamVideo';

// 트레일러 — 대표 이미지 위 "트레일러 재생"을 누르면 그 자리에서 재생 (영상이 있을 때만 그려진다)
export default function DetailTrailer({ image, videoUrl, name }: { image: string | null; videoUrl: string; name: string }) {
  const [playing, setPlaying] = useState(false);
  const title = `${name} 트레일러`;
  return (
    <section className="dx-trailer" aria-label="트레일러">
      {playing ? (
        isSteamVideo(videoUrl)
          ? <SteamVideo url={videoUrl} title={title} fallbackImage={image || undefined} autoPlay />
          : <YouTubeLite url={videoUrl} title={title} fallbackImage={image || undefined} wide autoPlay />
      ) : (
        <div className="dx-trailer-poster">
          {image && <GameImage src={image} fallbackWidth={1280} alt="" />}
          <button type="button" className="dh-play" onClick={() => setPlaying(true)} aria-label={`${title} 재생`}>트레일러 재생</button>
        </div>
      )}
    </section>
  );
}
