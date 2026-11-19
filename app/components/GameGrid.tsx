'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useGameFilters } from '../lib/useGameFilters';
import { useGameIndex } from '../lib/useGameIndex';
import MainHero from './home/mn/MainHero';
import SearchResults from './search/SearchResults';
import Loader from './status/Loader';
import { FilterPanel } from './search/SearchPanel';
import PeopleProvider from './home/PeopleContext';
import '../brand-tokens.css';
import './home/mn/mn.css';
import '../mono-page.css';
import '../mono-lists.css';

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

// 메인 화면 틀 — 홈 섹션은 서버에서 그려 받고(sections), 검색·필터·결과만 여기서 상태로 다룬다
// 전체 게임 목록은 첫 화면 뒤에 따로 받아서(useGameIndex) 받은 뒤부터 검색·필터·자동완성이 브라우저에서 바로 동작
export default function GameGrid({ firstSection, sections, top10Ids = [], peopleReady = true, heroCovers = [], member = false }: { firstSection: ReactNode; sections: ReactNode; top10Ids?: string[]; peopleReady?: boolean; heroCovers?: string[]; member?: boolean }) {
  const index = useGameIndex();
  const filters = useGameFilters(index.games, index.tree);
  const { showResults, normalizedQuery } = filters;
  const showHome = !showResults && !normalizedQuery;
  const sidebar = useWide() && !showHome;

  return (
    <PeopleProvider filters={filters} recsReady={peopleReady}>
      {/* 홈 화면(결과 없을 때)만 새 브랜드 루트(.mn-page). 같은 div의 클래스만 바뀌어서 입력 중에도 검색창이 그대로 유지된다 */}
      <div className={showHome ? `mn mn-page${member ? ' mn-member' : ''}` : 'mn mn-inner'}>
        {/* 제목 → 3칸 검색창 + AI 추천 (결과 화면에서는 검색창 줄만) */}
        {/* 첫 화면 래퍼(.mn-fold, 홈만): 히어로 + 인원별 추천을 화면 높이에 맞춘다. 래퍼 div는 항상 있어서 검색 중에도 검색창이 다시 만들어지지 않는다 */}
        <div className={showHome ? 'mn-fold' : undefined}>
          <MainHero games={index.games || []} filters={filters} showHome={showHome} sidebar={sidebar} covers={heroCovers} member={member} />
          {showHome && <div className="mn-fold-next"><div className="mn-wrap">{firstSection}</div></div>}
        </div>

        {/* 나머지 섹션 — 결과 없을 때만 */}
        {showHome && <div className="home-only mn-rest"><div className="mn-wrap">{sections}</div></div>}

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
