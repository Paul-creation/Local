'use client';

import { useGameFilters } from '../lib/useGameFilters';
import HomeSections from './home/HomeSections';
import SearchPanel from './search/SearchPanel';
import SearchResults from './search/SearchResults';

export default function GameGrid({ games, hideHero = false }: { games: any[], hideHero?: boolean }) {
  const filters = useGameFilters(games);
  const { showResults, normalizedQuery } = filters;

  return (
    <>
      <SearchPanel games={games} filters={filters} />

      {/* 히어로/섹션 — 결과 없을 때만 */}
      {!hideHero && !showResults && !normalizedQuery && <HomeSections games={games} />}

      {/* 결과 + 하단 비교 바 — 링크 복사 상태가 유지되도록 항상 마운트 */}
      <SearchResults filters={filters} />
    </>
  );
}
