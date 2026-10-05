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
      {/* 이전·다음 + 몇 번째인지 (점 대신 — 게임이 많아도 버튼마다 터치 영역 44px) */}
      {games.length > 1 && (
        <div className="feature-nav">
          <button type="button" className="btn btn-outline feature-nav-btn" onClick={() => setIndex((i) => (i - 1 + games.length) % games.length)} aria-label="이전 추천 게임">이전</button>
          <span className="feature-nav-count num" aria-live="polite">{index + 1} / {games.length}</span>
          <button type="button" className="btn btn-outline feature-nav-btn" onClick={() => setIndex((i) => (i + 1) % games.length)} aria-label="다음 추천 게임">다음</button>
        </div>
      )}
    </div>
  );
}
