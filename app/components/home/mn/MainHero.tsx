// 담당: Paul(메인 배너·디자인)
'use client';

import { useEffect, useRef, useState } from 'react';
import SearchPanel from '../../search/SearchPanel';
import AbSearch from '../ab/AbSearch';
import AIRecommend from '../../AIRecommend';
import { SparkIcon } from './icons';
import type { GameFilters } from '../../../lib/useGameFilters';

// 메인 히어로: 배경 세로 표지 벽(흐리게, 3줄·열 단위로 채움) 위에 어두운 그라데이션 두 겹 → 제목 한 줄 → 3칸 검색창(+ AI 추천)
// member(로그인): 제목 없이 검색창만 가운데, 높이도 낮다 (서버에서 정해 첫 HTML부터 그렇다). 표지 벽·그라데이션은 방문자와 같다
// 검색 결과를 볼 때는 예전 모양(검색창 줄만)으로 돌아간다 — 검색창이 같은 자리에 남도록 요소 위치는 두 모드가 같고 클래스만 바뀐다 (입력 중 포커스 유지)
// home-only로 감싼 부분은 필터 주소로 들어온 첫 HTML에서 숨김 (globals.css)
// 상황 타일("이런 판 어때요?")·인원 탭·필터 칩·현황 숫자는 히어로 밖 섹션에 있다 (HomeSections)
const EAGER_TILES = 12; // 앞 4열(375px 화면이 덮는 만큼)만 바로 받고, 나머지는 lazy

export default function MainHero({ games, filters, showHome, sidebar = false, covers, member = false }: { games: any[]; filters: GameFilters; showHome: boolean; sidebar?: boolean; covers: string[]; member?: boolean }) { // eslint-disable-line @typescript-eslint/no-explicit-any
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

  return (
    <div className={showHome ? `mn-hero${member ? ' mn-hero-member' : ''}` : 'home-hero'}>
      {showHome && covers.length >= 12 && (
        <div ref={bgRef} className={`home-only mn-hero-bg${bgReady ? ' is-ready' : ''}`} aria-hidden="true">
          {covers.map((src, i) => <img key={`${i}-${src}`} src={src} alt="" loading={i < EAGER_TILES ? 'eager' : 'lazy'} decoding="async" fetchPriority="low" />)}
        </div>
      )}
      <div className={showHome ? 'mn-wrap mn-hero-inner' : undefined}>
        {showHome && !member && (
          <div className="home-only mn-intro" data-tour="hero">
            <h1 className="mn-h1">금요일 밤,<br />친구들이랑 뭐 하지?</h1>
          </div>
        )}
        {showHome ? (
          // 홈: 에어비앤비식 3칸 검색창(AI 추천 버튼은 그 오른쪽 그대로). 결과 화면(아래)은 예전 검색창 그대로
          <div className="ab-hero" data-tour="cmdbar">
            {member
              ? <div data-tour="welcome-member"><AbSearch games={games} trailing={<AIRecommend icon={<SparkIcon />} />} /></div>
              : <AbSearch games={games} trailing={<AIRecommend icon={<SparkIcon />} />} />}
          </div>
        ) : (
          <div className="home-search">
            <SearchPanel games={games} filters={filters} sidebar={sidebar} floating={false} />
          </div>
        )}
      </div>
    </div>
  );
}
