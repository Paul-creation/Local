import type { Metadata } from 'next';
import { Note, PcChip, Seg, getHeroEvent } from '../hero-parts';

export const metadata: Metadata = { title: '메인 상단 시안 C', robots: { index: false, follow: false } };

// 가운데 정렬, 가장 큰 헤드라인(포인트 색 한 구절) — 이벤트는 테두리 pill 라벨, 인원은 "몇 명이서?" 질문 옆에
export default function HeroC() {
  const ev = getHeroEvent();
  return (
    <main className="page hx hx-c">
      <Note>C · 테두리 pill 라벨 / 가장 큰 헤드라인(포인트 색 한 구절) / 검색창 안 필터·AI / 몇 명이서? 질문형 인원 줄 / 가이드 링크는 맨 아래</Note>
      <p className="hx-label"><b>{ev.label}</b><a href={ev.href}>{ev.title}</a></p>
      <h1 className="hx-title">금요일 밤,<br />친구들이랑 <em>뭐 하지?</em></h1>
      <div className="hx-bar">
        <input type="search" placeholder="게임 이름이나 태그로 검색" aria-label="검색" />
        <button type="button" className="hx-inline-btn">필터<span className="n">2</span></button>
        <button type="button" className="hx-ai">AI 추천</button>
      </div>
      <div className="hx-row"><span className="hx-q">몇 명이서?</span><Seg /><PcChip /></div>
      <a className="hx-guide" href="/guide">1분 사용 가이드 →</a>
    </main>
  );
}
