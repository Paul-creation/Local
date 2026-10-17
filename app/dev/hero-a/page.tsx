import type { Metadata } from 'next';
import { HEADLINE, Note, PcChip, Seg, getHeroEvent } from '../hero-parts';

export const metadata: Metadata = { title: '메인 상단 시안 A', robots: { index: false, follow: false } };

// 가운데 정렬 — 이벤트는 헤드라인 위 작은 라벨, 가이드는 헤드라인 아래 글자 링크, 검색창 옆에 AI 추천 버튼 하나
export default function HeroA() {
  const ev = getHeroEvent();
  return (
    <main className="page hx hx-a">
      <Note>A · 가운데 정렬 / 작은 라벨 → 헤드라인 → 글자 링크 → 검색창 + 옆 AI 버튼 → 인원 pill + PC 칩</Note>
      <p className="hx-label"><b>{ev.label}</b><a href={ev.href}>{ev.title} →</a></p>
      <h1 className="hx-title">{HEADLINE}</h1>
      <a className="hx-guide" href="/guide">1분 사용 가이드 →</a>
      <div className="hx-search">
        <div className="hx-bar">
          <input type="search" placeholder="게임 이름이나 태그로 검색" aria-label="검색" />
          <button type="button" className="hx-inline-btn">필터<span className="n">2</span></button>
        </div>
        <button type="button" className="hx-ai">AI 추천</button>
      </div>
      <div className="hx-row"><Seg /><PcChip /></div>
    </main>
  );
}
