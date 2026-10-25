// 담당: 친구(검색·태그·비교)
'use client';

import dynamic from 'next/dynamic';
import AIRecommend from '../AIRecommend';
import SearchBox from './SearchBox';
import type { ReactNode } from 'react';
import type { GameFilters } from '../../lib/useGameFilters';

// 필터 본문은 처음 열 때 받는다 (메인 첫 로드 JS에 태그 설명·나무 화면 코드를 싣지 않음). 버튼에 손을 올리면 미리 받기 시작
const loadFilterPanel = () => import('./FilterPanel');
export const FilterPanel = dynamic(loadFilterPanel, {
  ssr: false,
  loading: () => <div className="filter-panel filter-loading"><p className="filter-note">필터 불러오는 중…</p></div>,
});

// 검색창 + 필터 버튼 + AI 추천. 필터 본문은 FilterPanel
// sidebar: 데스크톱 결과 화면 — 필터가 왼쪽 칸에 늘 펼쳐져 있으므로 여기서는 버튼·펼침을 숨김 (GameGrid)
// shortPlaceholder: 휴대폰 폭에서 검색창 안내 글자 / lead·hint·aiIcon: 메인 리디자인 커맨드바(components/home/mn)가 검색 아이콘·⌘K 표시·AI 추천 아이콘을 얹을 때만 넘긴다
export default function SearchPanel({ games, filters, sidebar = false, lead, hint, aiIcon, shortPlaceholder }: { games: any[], filters: GameFilters, sidebar?: boolean, lead?: ReactNode, hint?: ReactNode, aiIcon?: ReactNode, shortPlaceholder?: string }) {
  const { filterOpen, setFilterOpen, selectedCount } = filters;

  return (
    <>
      {/* 큰 상자는 검색창 하나(필터는 안쪽 오른쪽) + 옆에 강조 버튼 AI 추천 */}
      <div className="search-row">
        <SearchBox games={games} filters={filters} leading={lead} shortPlaceholder={shortPlaceholder} trailing={!sidebar && (
          <button
            type="button"
            className={`filter-toggle${filterOpen ? ' open' : ''}`}
            aria-expanded={filterOpen}
            aria-controls="filter-panel"
            onPointerEnter={() => { loadFilterPanel(); }}
            onFocus={() => { loadFilterPanel(); }}
            onClick={() => setFilterOpen(v => !v)}
          >
            필터
            {selectedCount > 0 && <span className="filter-count" aria-label={`${selectedCount}개 선택됨`}>{selectedCount}</span>}
          </button>
        )} />
        {hint}
        <div className="search-actions">
          <AIRecommend icon={aiIcon} />
        </div>
      </div>

      {filterOpen && !sidebar && <div className="filter-wrap"><FilterPanel filters={filters} /></div>}
    </>
  );
}
