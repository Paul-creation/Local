import type { Metadata } from 'next';
import { HEADLINE, Note, PcChip, Seg, getHeroEvent } from '../hero-parts';

export const metadata: Metadata = { title: '메인 상단 시안 B', robots: { index: false, follow: false } };

// 왼쪽 정렬 — 맨 위 얇은 한 줄 공지(텍스트+링크), 검색창 안에 필터·AI 추천까지 모두 들어감
export default function HeroB() {
  const ev = getHeroEvent();
  return (
    <main className="page hx hx-b">
      <div className="hx-b-notice">
        <b>{ev.label}</b><span className="t">{ev.title}</span><a href={ev.href}>보러 가기 →</a>
      </div>
      <div className="wrap">
        <Note>B · 맨 위 한 줄 공지 / 왼쪽 정렬 헤드라인 / 검색창 하나에 필터·AI 모두 안쪽 / 아래 pill + PC 칩</Note>
        <h1 className="hx-title">{HEADLINE}</h1>
        <a className="hx-guide" href="/guide">1분 사용 가이드 →</a>
        <div className="hx-bar">
          <input type="search" placeholder="게임 이름이나 태그로 검색" aria-label="검색" />
          <button type="button" className="hx-inline-btn">필터<span className="n">2</span></button>
          <button type="button" className="hx-ai">AI 추천</button>
        </div>
        <div className="hx-row"><Seg /><PcChip /></div>
      </div>
    </main>
  );
}
