// 담당: 친구(검색·태그·비교)
'use client';

import ShareButton from '../ShareButton';
import { SORTS, type GameFilters } from '../../lib/useGameFilters';
import { filterConditions } from '../../lib/filterConditions';
import { getTagDescription } from './TagHelp';
import { tagKeyLabel } from '../../lib/tagSearch';
import ResultCard from './ResultCard';
import PageSkeleton from '../status/PageSkeleton';

export default function SearchResults({ filters, top10Ids = [], loadError = false, onRetry }: { filters: GameFilters; top10Ids?: string[]; loadError?: boolean; onRetry?: () => void }) {
  const {
    loaded, showResults, normalizedQuery, filtered,
    compareList, compareError, toggleCompare,
    rememberList, resetFilters, visibleCount, showMore, tree,
    sort, setSort, clearConditions, setInput, myPcActive,
  } = filters;
  // 결과 위 조건 칩 (태그는 검색창 안 칩으로 보이므로 뺌) / 0개일 때 요약은 태그까지 전부
  const conditions = filterConditions(filters, { withTags: false });
  const summary = filterConditions(filters).map((c) => c.label);

  return (
    <>
      {/* 전체 목록이 아직 안 왔으면 결과 자리에 로딩 막대, 받기에 실패하면 다시 시도 */}
      {(showResults || normalizedQuery) && !loaded && (
        loadError ? (
          <div className="results-empty">
            <p className="results-empty-title">게임 목록을 불러오지 못했어요</p>
            <div className="results-empty-actions">
              <button type="button" onClick={onRetry} className="btn btn-outline">다시 시도</button>
            </div>
          </div>
        ) : <PageSkeleton />
      )}

      {/* 결과 */}
      {(showResults || normalizedQuery) && loaded && (
        <>
          <div className="results-head">
            {/* 태그로 들어왔을 때 맨 위 한 줄 — 용어집 설명이 있으면 이름 + 설명, 없으면 이름만 */}
            {filters.selectedTags.map((t) => {
              const name = tagKeyLabel(t, tree);
              if (!name) return null;
              const desc = getTagDescription(name);
              return <p key={t} className="results-tag-note"><strong>{name}</strong>{desc && <> {desc}</>}</p>;
            })}
            <div className="results-head-row">
              <h2 className="results-count">검색 결과 <strong className="num">{filtered.length.toLocaleString('ko-KR')}</strong>개{myPcActive && <>{' '}<span className="results-scope">내 PC 기준</span></>}</h2>
              <div className="results-head-actions">
                <ShareButton variant="text" title="게임 검색 결과" text="이 조건으로 찾은 게임들 같이 보자!" />
                <button type="button" onClick={resetFilters} className="results-home">← 홈으로</button>
              </div>
            </div>
            <div className="results-head-row">
              <div className="tabs" role="tablist" aria-label="정렬">
                {SORTS.map(([key, label]) => (
                  <button key={key || 'default'} type="button" role="tab" aria-selected={sort === key} className={`tab${sort === key ? ' is-active' : ''}`} onClick={() => setSort(key)}>
                    {label}
                  </button>
                ))}
              </div>
              {compareError
                ? <span className="results-hint is-error" role="alert">{compareError}</span>
                : filtered.length >= 2 && <span className="results-hint">카드의 + 비교로 최대 3개까지 비교해 보세요</span>}
            </div>
            {conditions.length > 0 && (
              <div className="results-conditions">
                {conditions.map((c) => (
                  <button key={c.key} type="button" className="chip on condition-chip" onClick={c.clear} aria-label={`${c.label} 조건 지우기`}>
                    {c.label} <span aria-hidden="true">×</span>
                  </button>
                ))}
                <button type="button" className="results-clear" onClick={clearConditions}>전체 지우기</button>
              </div>
            )}
          </div>

          {filtered.length === 0 ? (
            <div className="results-empty">
              <p className="results-empty-title">선택한 조건을 모두 만족하는 게임을 찾지 못했어요.</p>
              <p className="results-empty-summary">조건을 하나 빼보거나 필터를 초기화해 보세요.</p>
              {summary.length > 0 && <p className="results-empty-summary">고른 조건: {summary.join(' · ')}</p>}
              <div className="results-empty-actions">
                <button type="button" className="btn btn-outline" onClick={() => { clearConditions(); setInput(''); }}>필터 초기화</button>
                <a href="/feedback?kind=info" className="btn btn-primary">이런 게임 알려주기</a>
              </div>
            </div>
          ) : (
            <>
            <div className="result-grid">
              {filtered.slice(0, visibleCount).map((game, i) => {
                const isSelected = !!compareList.find(g => g.id === game.id);
                return (
                  <ResultCard
                    key={game.id}
                    game={game}
                    tree={tree}
                    isTop10={top10Ids.includes(game.id)}
                    eager={i < 4}
                    onClick={rememberList}
                    compare={{ selected: isSelected, disabled: !isSelected && compareList.length >= 3, onToggle: () => toggleCompare(game) }}
                  />
                );
              })}
            </div>
            {/* 한 번에 다 그리면 느려서 24개씩 나눠 보기 */}
            {filtered.length > visibleCount && (
              <div className="results-more">
                <button type="button" onClick={showMore} className="btn btn-outline">
                  더 보기 ({visibleCount}/{filtered.length})
                </button>
              </div>
            )}
            </>
          )}
        </>
      )}

      {/* 비교 담기는 오른쪽 아래 비교함 알약(components/CompareTray)으로 — 화면 아래를 덮는 바는 쓰지 않음 */}
    </>
  );
}
