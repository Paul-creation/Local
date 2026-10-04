'use client';

import type { ReactNode } from 'react';
import { useGameFilters } from '../lib/useGameFilters';
import { useGameIndex } from '../lib/useGameIndex';
import HomeHero from './home/HomeHero';
import SearchResults from './search/SearchResults';
import PageSkeleton from './status/PageSkeleton';

// 메인 화면 틀 — 이벤트·홈 섹션은 서버에서 그려 받고(event·sections), 검색·필터·결과만 여기서 상태로 다룬다
// 전체 게임 목록은 첫 화면 뒤에 따로 받아서(useGameIndex) 받은 뒤부터 검색·필터·자동완성이 브라우저에서 바로 동작
export default function GameGrid({ event, sections, presentTags, top10Ids = [] }: { event: ReactNode; sections: ReactNode; presentTags: string[]; top10Ids?: string[] }) {
  const index = useGameIndex();
  const filters = useGameFilters(index.games);
  const { showResults, normalizedQuery } = filters;
  const showHome = !showResults && !normalizedQuery;

  return (
    <>
      {/* 이벤트 + 가운데 큰 검색창 */}
      <HomeHero event={event} games={index.games || []} presentTags={presentTags} filters={filters} showEvent={showHome} />

      {/* 히어로/섹션 — 결과 없을 때만 */}
      {showHome && <div className="home-only">{sections}</div>}

      {/* 필터 주소로 들어온 첫 HTML에서만 보이는 로딩 막대 (React가 그리기 시작하면 결과 영역이 대신함) */}
      {showHome && <div className="home-url-skel"><PageSkeleton /></div>}

      {/* 결과 + 하단 비교 바 — 링크 복사 상태가 유지되도록 항상 마운트 */}
      <SearchResults filters={filters} top10Ids={top10Ids} loadError={index.error} onRetry={index.retry} />
    </>
  );
}
