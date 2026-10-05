'use client';

import { useEffect, useState } from 'react';
import FeatureCard from './home/FeatureCard';

// 메인 "추천 게임" — 4초마다 넘어가는 카드 하나 (모양은 이번주의 게임과 같은 FeatureCard)
export default function BannerCarousel({ games }: { games: any[] }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (games.length <= 1) return;
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % games.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [games.length]);

  if (games.length === 0) return null;

  return (
    <div className="feature-carousel">
      <FeatureCard game={games[index]} label="추천 게임" />
      {/* 보이는 점은 작게, 누르는 영역은 44px. 점이 많아 한 줄에 다 안 들어가면 너비만 나눠 가짐 */}
      {games.length > 1 && (
        <div className="feature-dots">
          {games.map((g, i) => (
            <button key={g.id} type="button" onClick={() => setIndex(i)} aria-label={`${i + 1}번째 추천 게임`} aria-current={i === index}>
              <span />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
