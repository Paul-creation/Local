// 담당: Paul(메인 배너·디자인)
'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import SearchPanel from '../../search/SearchPanel';
import AbSearch from '../ab/AbSearch';
import Situations from '../ab/Situations';
import AIRecommend from '../../AIRecommend';
import CmdRow from './CmdRow';
import { SparkIcon } from './icons';
import type { GameFilters } from '../../../lib/useGameFilters';
import type { HomeStats } from '../../../lib/homeMain';

// 메인 히어로(모노 + 흰색 네온): 배경 세로 표지 벽(3줄, 열 단위로 채움) → 이벤트 한 줄 → 헤드라인 → 서브카피 → 커맨드바(검색 + AI 추천 / 인원 탭 · 칩) → 숫자 3개
// 검색 결과를 볼 때는 예전 모양(검색창 줄만)으로 돌아간다 — 검색창이 같은 자리에 남도록 요소 위치는 두 모드가 같고 클래스만 바뀐다 (입력 중 포커스 유지)
// home-only로 감싼 부분은 필터 주소로 들어온 첫 HTML에서 숨김 (globals.css)
const EAGER_TILES = 12; // 앞 4열(375px 화면이 덮는 만큼)만 바로 받고, 나머지는 lazy
const nf = new Intl.NumberFormat('ko-KR');
const STATS: { key: keyof HomeStats; label: string }[] = [
  { key: 'games', label: '비교할 수 있는 게임' },
  { key: 'sale', label: '오늘 할인 중' },
  { key: 'soon', label: '출시 예정' },
];

export default function MainHero({ games, filters, showHome, sidebar = false, event, covers, stats }: { games: any[]; filters: GameFilters; showHome: boolean; sidebar?: boolean; event?: ReactNode; covers: string[]; stats: HomeStats }) {
  // 표지 벽 — 하나씩 툭툭 나타나지 않게 전체를 투명에서 시작해, 이미지 대부분이 받아지면(또는 600ms 뒤) 400ms에 걸쳐 나타난다 (absolute 배경이라 레이아웃 영향 없음)
  const bgRef = useRef<HTMLDivElement>(null);
  const [bgReady, setBgReady] = useState(false);
  useEffect(() => {
    const el = bgRef.current;
    if (!el) return;
    // 화면 밖으로 잘리는 타일은 lazy라 받아지지 않는다 — 화면 안에 들어오는 타일만 센다
    const imgs = [...el.querySelectorAll('img')].filter((i) => i.getBoundingClientRect().left < window.innerWidth);
    const need = Math.ceil(imgs.length * 0.8);
    let done = false;
    const show = () => { if (!done) { done = true; setBgReady(true); } };
    const check = () => { if (imgs.filter((i) => i.complete).length >= need) show(); };
    imgs.forEach((i) => i.addEventListener('load', check));
    check();
    const t = window.setTimeout(show, 600);
    return () => { window.clearTimeout(t); imgs.forEach((i) => i.removeEventListener('load', check)); };
  }, [covers.length, showHome]);

  const shownStats = STATS.filter((s) => stats[s.key] != null);
  return (
    <div className={showHome ? 'mn-hero' : 'home-hero'}>
      {showHome && covers.length >= 12 && (
        <div ref={bgRef} className={`home-only mn-hero-bg${bgReady ? ' is-ready' : ''}`} aria-hidden="true">
          {covers.map((src, i) => <img key={`${i}-${src}`} src={src} alt="" loading={i < EAGER_TILES ? 'eager' : 'lazy'} decoding="async" fetchPriority="low" />)}
        </div>
      )}
      <div className={showHome ? 'mn-wrap mn-hero-inner' : undefined}>
        {showHome && (
          <div className="home-only mn-intro" data-tour="hero">
            {event}
            <h1 className="mn-h1">금요일 밤,<br />친구들이랑 뭐 하지?</h1>
            <p className="mn-sub">스팀, 유튜브, 할인 사이트를 따로 돌아다니지 않아도 돼요.{' '}<br />몇 명이서, 얼마에, 어떻게 하는지 한 곳에서.</p>
          </div>
        )}
        {showHome ? (
          // 홈: 에어비앤비식 3칸 검색창(AI 추천 버튼은 그 오른쪽 그대로) → 이런 판 어때요? 타일 → 기존 칩 줄. 결과 화면(아래)은 예전 검색창 그대로
          <div className="ab-hero" data-tour="cmdbar">
            <AbSearch games={games} trailing={<AIRecommend icon={<SparkIcon />} />} />
            <div className="home-only"><Situations /></div>
            <div className="home-only mn-cmd ab-chips-row"><CmdRow filters={filters} /></div>
          </div>
        ) : (
          <div className="home-search">
            <SearchPanel games={games} filters={filters} sidebar={sidebar} floating={false} />
          </div>
        )}
        {showHome && shownStats.length > 0 && (
          <dl className="home-only mn-stats">
            {shownStats.map((s) => (
              <div key={s.key}><dt>{s.label}</dt><dd>{nf.format(stats[s.key]!)}</dd></div>
            ))}
          </dl>
        )}
      </div>
    </div>
  );
}
