// 담당: 친구(검색·태그·비교)
'use client';

import Link from 'next/link';
import ShareButton from '../ShareButton';
import { getPriceInfo, getLowestTiming, PRICE_TYPE_LABEL } from '../../lib/price';
import LowestPriceBadge from '../LowestPriceBadge';
import { displayTags } from '../../lib/tagTree';
import { SORTS, type GameFilters } from '../../lib/useGameFilters';
import { filterConditions } from '../../lib/filterConditions';
import { playersText } from '../../lib/players';
import GameImage from '../GameImage';
import PageSkeleton from '../status/PageSkeleton';

export default function SearchResults({ filters, top10Ids = [], loadError = false, onRetry }: { filters: GameFilters; top10Ids?: string[]; loadError?: boolean; onRetry?: () => void }) {
  const {
    loaded, showResults, normalizedQuery, filtered,
    compareList, setCompareList, compareError, toggleCompare,
    rememberList, resetFilters, visibleCount, showMore, tree,
    sort, setSort, clearConditions, setInput,
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
            <div className="results-head-row">
              <h2 className="results-count">검색 결과 <strong className="num">{filtered.length.toLocaleString('ko-KR')}</strong>개</h2>
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
              {filtered.length >= 2 && <span className="results-hint">카드의 + 비교로 최대 3개까지 비교해 보세요</span>}
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
              <p className="results-empty-title">조건에 맞는 게임이 아직 없어요</p>
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
                const price = getPriceInfo(game);
                const isSelected = !!compareList.find(g => g.id === game.id);
                const tag = displayTags(tree, game, 1)[0];
                const meta = [game.category, playersText(game), tag].filter(Boolean).join(' · ');
                return (
                  <Link href={`/games/${game.id}`} key={game.id} className={`result-card lift${isSelected ? ' is-picked' : ''}`} onClick={rememberList}>
                    <span className="result-image">
                      <GameImage src={game.cover_image_url || game.card_image_url} steamSize="header" alt="" loading={i < 4 ? 'eager' : 'lazy'} />
                    </span>
                    <span className="result-body">
                      <span className="result-title">
                        {top10Ids.includes(game.id) && <span className="top10-badge">TOP 10</span>}
                        {game.name}
                      </span>
                      {meta && <span className="result-meta">{meta}</span>}
                      <span className="result-foot">
                        <span className="result-price">
                          {game.is_free ? (
                            <span className="price-final">무료</span>
                          ) : PRICE_TYPE_LABEL[game.price_type] ? (
                            // 월 구독·판매처에서 확인 게임은 예전 가격 대신 문구 (가격 슬라이더·할인 필터에서는 가격 없음으로 빠짐)
                            <span className="price-final no-discount">{PRICE_TYPE_LABEL[game.price_type]}</span>
                          ) : price ? (
                            <>
                              {price.discount > 0 && <span className="discount-badge">-{price.discount}%</span>}
                              <span className="price-final">{price.formattedFinal}</span>
                              <LowestPriceBadge timing={getLowestTiming(game, price)} />
                            </>
                          ) : null}
                        </span>
                        {/* COMPARE_V2 */}
                        <button
                          type="button"
                          className={`compare-btn${isSelected ? ' on' : ''}`}
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleCompare(game); }}
                          aria-pressed={isSelected}
                          aria-label={`${game.name} ${isSelected ? '비교에서 빼기' : '비교에 담기'}`}
                          disabled={!isSelected && compareList.length >= 3}
                        >
                          {isSelected ? '비교 중' : '+ 비교'}
                        </button>
                      </span>
                    </span>
                  </Link>
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

      {/* COMPARE_BAR_V2 */}
      {(showResults || normalizedQuery) && filtered.length >= 2 && <div className="compare-bar-space" />}
      {(showResults || normalizedQuery) && filtered.length >= 2 && (
        <div className="compare-bar">
          <div className="compare-bar-items">
            {compareError ? (
              <span className="compare-bar-error">{compareError}</span>
            ) : compareList.length === 0 ? (
              <span className="compare-bar-hint">카드의 + 비교를 눌러 게임을 골라주세요 (최대 3개)</span>
            ) : (
              compareList.map(g => <span key={g.id} className="compare-bar-item">{g.name}</span>)
            )}
          </div>
          <button type="button" onClick={() => setCompareList([])} className="compare-bar-reset">초기화</button>
          {compareList.length >= 2 ? (
            <a href={`/compare?ids=${compareList.map(g => g.id).join(',')}`} onClick={rememberList} className="btn btn-primary">
              비교하기 ({compareList.length}개)
            </a>
          ) : (
            <span className="btn btn-outline compare-bar-wait" aria-disabled="true">비교하기 ({compareList.length}/3)</span>
          )}
        </div>
      )}
    </>
  );
}
