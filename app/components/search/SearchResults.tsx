// 담당: 친구(검색·태그·비교)
'use client';

import Link from 'next/link';
import ShareButton from '../ShareButton';
import { getPriceInfo, getLowestTiming } from '../../lib/price';
import GotyBadge from '../GotyBadge';
import LowestPriceBadge from '../LowestPriceBadge';
import { translateTag } from '../../lib/tagTranslate';
import type { GameFilters } from '../../lib/useGameFilters';
import { playersText } from '../../lib/players';
import { sizedImage } from '../../lib/imageUrl';

export default function SearchResults({ filters, top10Ids = [] }: { filters: GameFilters; top10Ids?: string[] }) {
  const {
    showResults, normalizedQuery, hasFilters, filtered,
    compareList, setCompareList, compareError, toggleCompare,
    rememberList, resetFilters, visibleCount, showMore,
  } = filters;

  return (
    <>
      {/* 결과 */}
      {(showResults || normalizedQuery) && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ fontSize: 15, color: 'var(--text-dim)' }}>
              <strong style={{ color: 'var(--text)' }}>{filtered.length}개</strong> 게임
              {hasFilters && ' · 필터 적용됨'}
              {filtered.length >= 2 && (
                <span style={{ marginLeft: 8, fontSize: 14, color: 'var(--text-dimmer)' }}>
                  카드의 <b>+ 비교</b>로 최대 3개까지 비교해보세요
                </span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
              <ShareButton variant="text" label="🔗 공유하기" title="게임 검색 결과" text="이 조건으로 찾은 게임들 같이 보자!" />
              <button onClick={resetFilters} style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 15, fontWeight: 700, cursor: 'pointer', minHeight: 44, padding: '0 4px' }}>
                ← 홈으로
              </button>
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="empty-state">조건에 맞는 게임이 없어요.</div>
          ) : (
            <>
            <div className="grid">
              {filtered.slice(0, visibleCount).map((game, i) => {
                const price = getPriceInfo(game);
                const isSelected = compareList.find(g => g.id === game.id);
                return (
                  <Link href={`/games/${game.id}`} key={game.id} className="card" onClick={rememberList} style={isSelected ? { outline: '3px solid var(--accent)', outlineOffset: 2 } : undefined}>
                    <div className="card-image-wrap">
                      <img src={sizedImage(game.card_image_url || game.cover_image_url)} alt={game.name} loading={i < 4 ? 'eager' : 'lazy'} />
                      {/* COMPARE_V2 */}
                      <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleCompare(game); }}
                        aria-pressed={!!isSelected}
                        style={{
                          position: 'absolute', top: 10, right: 10, zIndex: 2,
                          padding: '8px 12px', minHeight: 36, borderRadius: 100, fontSize: 14, fontWeight: 700,
                          border: 'none', cursor: 'pointer',
                          background: isSelected ? 'var(--accent)' : 'rgba(0,0,0,0.6)',
                          color: '#fff',
                          opacity: !isSelected && compareList.length >= 3 ? 0.4 : 1,
                        }}
                      >
                        {isSelected ? '✓ 비교' : '+ 비교'}
                      </button>
                      <span className="platform-badge">{game.steam_appid ? 'Steam' : (({ epic: 'Epic', battlenet: 'Battle.net', riot: 'Riot' } as Record<string, string>)[game.source] ?? 'PC') /* STORE_BADGE */}</span>
                      <LowestPriceBadge timing={getLowestTiming(game, price)} overlay />
                    </div>
                    <div className="card-body">
                      {game.goty_awards && <div className="goty-row"><GotyBadge awards={game.goty_awards} /></div>}
                      <h3>{top10Ids.includes(game.id) && <span className="top10-badge" style={{ marginRight: 6 }}>TOP 10</span>}{game.name}</h3>
                      <p className="card-meta">
                        {game.recommended_players ? `추천 ${game.recommended_players}` : playersText(game)}
                        {game.difficulty ? ` · ${game.difficulty}` : ''}
                        {game.solo_playable === false && (
                          <span style={{ marginLeft: 6, color: 'var(--danger)', fontSize: 13, fontWeight: 700 }}>멀티필수</span>
                        )}
                      </p>
                      {game.tags?.slice(0, 3).map((tag: string) => (
                        <span key={tag} className="category-tag">{translateTag(tag)}</span>
                      ))}
                      {game.is_free ? (
                        <div className="price-row">
                          <span className="price-final" style={{ color: '#4a9e3a', fontWeight: 800 }}>무료 플레이</span>
                        </div>
                      ) : (
                        price && (
                          <div className="price-row">
                            {price.discount > 0 && (
                              <>
                                <span className="discount-badge">-{price.discount}%</span>
                                <span className="price-original">{price.formattedOriginal}</span>
                              </>
                            )}
                            <span className={`price-final ${price.discount === 0 ? 'no-discount' : ''}`}>
                              {price.formattedFinal}
                            </span>
                          </div>
                        )
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
            {/* 한 번에 다 그리면 느려서 24개씩 나눠 보기 */}
            {filtered.length > visibleCount && (
              <div style={{ textAlign: 'center', marginTop: 24 }}>
                <button onClick={showMore} style={{ background: 'var(--bg-card)', color: 'var(--text)', border: '1px solid var(--border-light)', borderRadius: 100, padding: '12px 28px', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
                  더 보기 ({visibleCount}/{filtered.length})
                </button>
              </div>
            )}
            </>
          )}
        </>
      )}

      {/* COMPARE_BAR_V2 */}
      {(showResults || normalizedQuery) && filtered.length >= 2 && <div style={{ height: 88 }} />}
      {(showResults || normalizedQuery) && filtered.length >= 2 && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          background: 'var(--bg-nav)', color: '#fff',
          padding: '12px 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          boxShadow: '0 -4px 16px rgba(0,0,0,0.2)',
          zIndex: 100, gap: 12,
        }}>
          <div style={{ display: 'flex', gap: 6, overflow: 'hidden', flex: 1, alignItems: 'center' }}>
            {compareError ? (
              <span style={{ fontSize: 15, color: '#ff6b6b' }}>{compareError}</span>
            ) : compareList.length === 0 ? (
              <span style={{ fontSize: 15, color: 'rgba(255,255,255,0.5)' }}>카드의 + 비교를 눌러 게임을 골라주세요 (최대 3개)</span>
            ) : (
              compareList.map(g => (
                <span key={g.id} style={{
                  fontSize: 14, background: 'rgba(255,255,255,0.15)',
                  padding: '4px 10px', borderRadius: 100,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 130,
                }}>{g.name}</span>
              ))
            )}
          </div>
          <button onClick={() => setCompareList([])} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', fontSize: 15, cursor: 'pointer', flexShrink: 0, minHeight: 44, padding: '0 4px' }}>
            초기화
          </button>
          {compareList.length >= 2 ? (
            <a href={`/compare?ids=${compareList.map(g => g.id).join(',')}`} onClick={rememberList} style={{
              background: 'var(--accent)', color: '#fff',
              padding: '8px 18px', borderRadius: 100,
              fontSize: 15, fontWeight: 700, textDecoration: 'none', flexShrink: 0,
            }}>
              비교하기 ({compareList.length}개)
            </a>
          ) : (
            <span style={{ background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.5)', padding: '8px 18px', borderRadius: 100, fontSize: 15, fontWeight: 700, flexShrink: 0 }}>비교하기 ({compareList.length}/3)</span>
          )}
        </div>
      )}
    </>
  );
}
