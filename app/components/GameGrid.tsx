'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useGameFilters } from '../lib/useGameFilters';
import { useGameIndex } from '../lib/useGameIndex';
import MainHero from './home/mn/MainHero';
import type { HomeStats } from '../lib/homeMain';
import SearchResults from './search/SearchResults';
import Loader from './status/Loader';
import { FilterPanel } from './search/SearchPanel';
import PeopleProvider from './home/PeopleContext';
import '../mono-tokens.css';
import './home/mn/mn.css';

// 데스크톱(1024px 이상)이면 결과 화면에서 필터를 왼쪽 칸에 늘 펼쳐 둔다. 휴대폰·태블릿은 버튼으로 여는 전체 화면 패널
const WIDE = '(min-width: 1024px)';
function useWide() {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(WIDE);
    const on = () => setWide(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return wide;
}

// 메인 화면 틀 — 홈 섹션(이벤트 배너 포함)은 서버에서 그려 받고(sections), 검색·필터·결과만 여기서 상태로 다룬다
// 전체 게임 목록은 첫 화면 뒤에 따로 받아서(useGameIndex) 받은 뒤부터 검색·필터·자동완성이 브라우저에서 바로 동작
export default function GameGrid({ event, sections, top10Ids = [], peopleReady = true, heroCovers = [], stats }: { event: ReactNode; sections: ReactNode; top10Ids?: string[]; peopleReady?: boolean; heroCovers?: string[]; stats: HomeStats }) {
  const index = useGameIndex();
  const filters = useGameFilters(index.games, index.tree);
  const { showResults, normalizedQuery } = filters;
  const showHome = !showResults && !normalizedQuery;
  const sidebar = useWide() && !showHome;

  return (
    <PeopleProvider filters={filters} recsReady={peopleReady}>
      {/* 홈 화면(결과 없을 때)만 모노 + 흰색 네온 루트(.mn). 같은 div의 클래스만 바뀌어서 입력 중에도 검색창이 그대로 유지된다 */}
      <div className={showHome ? 'mn mn-page' : undefined}>
        {/* 이벤트 라벨 → 제목 → 서브카피 → 커맨드바(검색·AI 추천·인원 탭·칩) → 숫자 (결과 화면에서는 검색창 줄만) */}
        <MainHero games={index.games || []} filters={filters} showHome={showHome} sidebar={sidebar} event={event} covers={heroCovers} stats={stats} />

        {/* 섹션 — 결과 없을 때만 */}
        {showHome && <div className="home-only"><div className="mn-wrap">{sections}</div></div>}

        {/* 필터 주소로 들어온 첫 HTML에서만 보이는 로딩 막대 (React가 그리기 시작하면 결과 영역이 대신함) */}
        {showHome && <div className="home-url-skel"><Loader /></div>}

        {/* 결과 + 하단 비교 바 — 링크 복사 상태가 유지되도록 항상 마운트. 데스크톱 결과 화면은 왼쪽 필터 + 오른쪽 결과 */}
        <div className={sidebar ? 'results-layout' : undefined}>
          {sidebar && <aside className="results-filter"><FilterPanel filters={filters} variant="sidebar" /></aside>}
          <div className="results-main">
            <SearchResults filters={filters} top10Ids={top10Ids} loadError={index.error} onRetry={index.retry} />
          </div>
        </div>
      </div>
    </PeopleProvider>
  );
}
