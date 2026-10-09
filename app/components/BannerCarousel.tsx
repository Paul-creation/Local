'use client';

import { useEffect, useState } from 'react';
import FeatureCard from './home/FeatureCard';

// 메인 "추천 게임" — 4초마다 넘어가는 카드 하나 (모양은 이번주의 게임과 같은 FeatureCard)
// 넘길 때는 카드가 옆으로 밀려 들어오는 transform 전환(280ms ease-out, .feature-slide). 움직임 줄이기 설정이면 전환 없이 바뀜
// 모든 슬라이드는 한 칸(grid)에 겹쳐 두고 위치만 translateX로 옮긴다 → 높이는 가장 큰 카드 기준, 마지막→처음도 한 칸만 이동
// 이미지는 지금 카드와 양옆 카드만 그린다 (나머지는 빈 칸)
export default function BannerCarousel({ games }: { games: any[] }) {
  const [index, setIndex] = useState(0);
  const n = games.length;

  useEffect(() => {
    if (n <= 1) return;
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % n);
    }, 4000);
    return () => clearInterval(timer);
  }, [n]);

  if (n === 0) return null;

  // 지금 카드 기준 위치 (…-1: 왼쪽 대기, 0: 보이는 카드, 1: 오른쪽 대기). 2장이면 0·1, 그 이상이면 둘레를 돌며 가장 가까운 쪽
  const lo = -Math.floor((n - 1) / 2);
  const offset = (i: number) => ((((i - index - lo) % n) + n) % n) + lo;

  return (
    <div className="feature-carousel">
      <div className="feature-viewport">
        <div className="feature-track">
          {games.map((g, i) => {
            const d = offset(i);
            const near = Math.abs(d) <= 1;
            return (
              <div
                key={g.id}
                className={`feature-slide${near ? ' is-near' : ''}`}
                style={{ transform: `translateX(${d * 100}%)` }}
                aria-hidden={d !== 0}
                inert={d !== 0}
              >
                {near && <FeatureCard game={g} label="추천 게임" />}
              </div>
            );
          })}
        </div>
      </div>
      {/* 이전·다음 + 몇 번째인지 (점 대신 — 게임이 많아도 버튼마다 터치 영역 44px) */}
      {n > 1 && (
        <div className="feature-nav">
          <button type="button" className="btn btn-outline feature-nav-btn" onClick={() => setIndex((i) => (i - 1 + n) % n)} aria-label="이전 추천 게임">이전</button>
          <span className="feature-nav-count num" aria-live="polite">{index + 1} / {n}</span>
          <button type="button" className="btn btn-outline feature-nav-btn" onClick={() => setIndex((i) => (i + 1) % n)} aria-label="다음 추천 게임">다음</button>
        </div>
      )}
    </div>
  );
}
