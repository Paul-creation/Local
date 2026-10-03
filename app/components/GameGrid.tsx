'use client';

import { useGameFilters } from '../lib/useGameFilters';
import HomeHero from './home/HomeHero';
import HomeSections from './home/HomeSections';
import SearchResults from './search/SearchResults';
import type { HotTab } from '../lib/hotChart';

export default function GameGrid({ games, hideHero = false, hotTabs = [], top10Ids = [] }: { games: any[], hideHero?: boolean, hotTabs?: HotTab[], top10Ids?: string[] }) {
  const filters = useGameFilters(games);
  const { showResults, normalizedQuery } = filters;
  const showHome = !hideHero && !showResults && !normalizedQuery;

  return (
    <>
      {/* 이벤트 + 가운데 큰 검색창 */}
      <HomeHero games={games} filters={filters} showEvent={showHome} />

      {/* 히어로/섹션 — 결과 없을 때만 */}
      {showHome && <HomeSections games={games} hotTabs={hotTabs} />}

      {/* 결과 + 하단 비교 바 — 링크 복사 상태가 유지되도록 항상 마운트 */}
      <SearchResults filters={filters} top10Ids={top10Ids} />
    </>
  );
}
