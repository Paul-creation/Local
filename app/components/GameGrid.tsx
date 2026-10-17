'use client';

import type { ReactNode } from 'react';
import { useGameFilters } from '../lib/useGameFilters';
import { useGameIndex } from '../lib/useGameIndex';
import HomeHero from './home/HomeHero';
import SearchResults from './search/SearchResults';
import PageSkeleton from './status/PageSkeleton';
import { FilterPanel } from './search/SearchPanel';
import PeopleProvider from './home/PeopleContext';
import GuideStrip from './home/GuideStrip';

// 메인 화면 틀 — 홈 섹션(이벤트 배너 포함)은 서버에서 그려 받고(sections), 검색·필터·결과만 여기서 상태로 다룬다
// 전체 게임 목록은 첫 화면 뒤에 따로 받아서(useGameIndex) 받은 뒤부터 검색·필터·자동완성이 브라우저에서 바로 동작
export default function GameGrid({ event, sections, top10Ids = [], peopleReady = true }: { event: ReactNode; sections: ReactNode; top10Ids?: string[]; peopleReady?: boolean }) {
  const index = useGameIndex();
  const filters = useGameFilters(index.games, index.tree);
  const { showResults, normalizedQuery, filterOpen } = filters;
  const showHome = !showResults && !normalizedQuery;

  return (
    <PeopleProvider filters={filters} recsReady={peopleReady}>
      {/* 필터를 열면 아래 메인 콘텐츠 자리를 필터 전용 화면이 대신한다. 메인은 hidden으로만 가려 상태(링크 복사 등)와 스크롤 위치 복귀를 유지 */}
      {filterOpen && <FilterPanel filters={filters} />}
      <div hidden={filterOpen}>
        {/* 이벤트 배너 — 페이지 맨 위, 전체 폭. 검색·필터 결과 화면에서는 숨김 */}
        {showHome && <div className="home-only">{event}</div>}

        {/* 첫 방문 안내 띠 — 이벤트 배너 아래, 닫은 적 없을 때만 (마운트 뒤 표시, 자리는 app/page.tsx 스크립트가 미리 잡음) */}
        {showHome && <div className="home-only"><GuideStrip /></div>}

        {/* 제목 → 가운데 검색창 → 인원 선택 → 내 PC 바 */}
        <HomeHero games={index.games || []} filters={filters} showEvent={showHome} />

        {/* 히어로/섹션 — 결과 없을 때만 */}
        {showHome && <div className="home-only">{sections}</div>}

        {/* 필터 주소로 들어온 첫 HTML에서만 보이는 로딩 막대 (React가 그리기 시작하면 결과 영역이 대신함) */}
        {showHome && <div className="home-url-skel"><PageSkeleton /></div>}

        {/* 결과 + 하단 비교 바 — 링크 복사 상태가 유지되도록 항상 마운트 */}
        <div className="results-main">
          <SearchResults filters={filters} top10Ids={top10Ids} loadError={index.error} onRetry={index.retry} />
        </div>
      </div>
    </PeopleProvider>
  );
}
