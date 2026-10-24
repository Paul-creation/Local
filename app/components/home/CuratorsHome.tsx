'use client';

// 메인 "인스타에서 봤던 그 게임" — 인원별 추천과 같은 게임 카드(GameCard)·같은 가로 캐러셀(PC 3.2장 + 화살표, 모바일 1.15장 스와이프)
// 카드 밖 아래에 출처 "@계정 소개"(누르면 /c/handle — 카드가 이미 링크라 안에 넣지 않음, /c/handle의 "원본 게시물 보기"와 같은 자리). 제목·부제 아래 계정 칩("@계정 N")도 /c/handle
// 데이터는 서버(page.tsx → getHomeCurators)가 고름: 동의 계정 2개 미만이면 null이라 섹션 자체를 그리지 않는다
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import GameCard from './GameCard';
import { gameName } from '../../lib/gameName';
import type { HomeCurators } from '../../lib/curators';

export default function CuratorsHome({ data }: { data: HomeCurators | null }) {
  const rowRef = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ start: true, end: false });
  const updateEdge = useCallback(() => {
    const el = rowRef.current;
    if (!el) return;
    const start = el.scrollLeft <= 1;
    const end = el.scrollLeft + el.clientWidth >= el.scrollWidth - 1;
    setEdge((e) => (e.start === start && e.end === end ? e : { start, end }));
  }, []);
  useEffect(() => {
    updateEdge();
    window.addEventListener('resize', updateEdge);
    return () => window.removeEventListener('resize', updateEdge);
  }, [updateEdge]);
  const page = (dir: 1 | -1) => {
    const el = rowRef.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.9 });
  };
  if (!data) return null;
  const { chips, cards } = data;
  return (
    <section className="home-block people-block curators-home" aria-labelledby="curators-home-title">
      <div className="home-block-head curators-home-head">
        <div className="curators-home-titles">
          <h2 id="curators-home-title" className="section-title">인스타에서 봤던 그 게임</h2>
          <p className="curators-home-sub">저장만 해두고 잊어버린 게임, 소개한 계정별로 모아뒀어요</p>
        </div>
        {cards.length > 3 && (
          <div className="people-arrows">
            <button type="button" className="people-arrow" aria-label="이전 게임" disabled={edge.start} onClick={() => page(-1)}>‹</button>
            <button type="button" className="people-arrow" aria-label="다음 게임" disabled={edge.end} onClick={() => page(1)}>›</button>
          </div>
        )}
      </div>
      <ul className="curators-home-chips">
        {chips.map((c) => (
          <li key={c.handle}><Link href={`/c/${encodeURIComponent(c.handle)}`} className="chip">@{c.displayName} <span className="chip-n">{c.gameCount}</span></Link></li>
        ))}
      </ul>
      <div className="people-cards" ref={rowRef} onScroll={updateEdge} tabIndex={0} role="region" aria-label="인스타에서 소개된 게임 목록">
        {cards.map((c, i) => (
          <div key={c.game.id} className="people-item curator-item">
            <GameCard game={c.game} eager={i === 0} ariaLabel={`${gameName(c.game as { name?: string | null; display_name?: string | null })} 상세 보기`} />
            <Link href={`/c/${encodeURIComponent(c.handle)}`} className="gc-source">@{c.displayName} 소개</Link>
          </div>
        ))}
      </div>
    </section>
  );
}
