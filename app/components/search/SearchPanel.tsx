// 담당: 친구(검색·태그·비교)
'use client';

import { useEffect } from 'react';
import dynamic from 'next/dynamic';
import AIRecommend from '../AIRecommend';
import SearchBox from './SearchBox';
import type { GameFilters } from '../../lib/useGameFilters';

// 필터 본문은 처음 열 때 받는다 (메인 첫 로드 JS에 태그 설명·나무 화면 코드를 싣지 않음). 버튼에 손을 올리면 미리 받기 시작
const loadFilterPanel = () => import('./FilterPanel');
const FilterPanel = dynamic(loadFilterPanel, {
  ssr: false,
  loading: () => <div className="filter-panel"><p className="filter-note" style={{ padding: 20 }}>필터 불러오는 중…</p></div>,
});

// 검색창 + 필터 버튼 + AI 추천. 필터 본문은 FilterPanel
export default function SearchPanel({ games, filters }: { games: any[], filters: GameFilters }) {
  const { filterOpen, setFilterOpen, selectedCount } = filters;

  // 휴대폰 전체 화면 패널이 열려 있는 동안 뒤 화면이 같이 스크롤되지 않게
  useEffect(() => {
    if (!filterOpen) return;
    document.body.classList.add('filter-open');
    return () => document.body.classList.remove('filter-open');
  }, [filterOpen]);

  return (
    <>
      {/* 검색창 + 필터(테두리 버튼) + AI 추천(포인트 버튼) */}
      <div className="search-row">
        <SearchBox games={games} filters={filters} />
        <div className="search-actions">
          <button
            type="button"
            className={`btn btn-outline filter-toggle${filterOpen ? ' open' : ''}`}
            aria-expanded={filterOpen}
            aria-controls="filter-panel"
            onPointerEnter={() => { loadFilterPanel(); }}
            onFocus={() => { loadFilterPanel(); }}
            onClick={() => setFilterOpen(v => !v)}
          >
            필터
            {selectedCount > 0 && <span className="filter-count" aria-label={`${selectedCount}개 선택됨`}>{selectedCount}</span>}
          </button>
          <AIRecommend />
        </div>
      </div>

      {filterOpen && <div className="filter-wrap"><FilterPanel filters={filters} /></div>}
    </>
  );
}
