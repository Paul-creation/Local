// 담당: 친구(검색·태그·비교)
'use client';

import Link from 'next/link';
import { useState } from 'react';
import { getPriceInfo } from '../../lib/price';
import { translateTag } from '../../lib/tagTranslate';
import type { GameFilters } from '../../lib/useGameFilters';

function getPriceTiming(game: any) {
  const price = getPriceInfo(game);
  if (!price || !game.lowest_price || game.is_free) return null;
  if (price.discount === 0) return null;
  if (price.final < 100) return null;
  if (game.lowest_price < 100) return null;
  const ratio = price.final / game.lowest_price;
  if (ratio <= 1.05) return 'best';
  if (ratio <= 1.15) return 'near';
  return null;
}

export default function SearchResults({ filters }: { filters: GameFilters }) {
  const {
    showResults, normalizedQuery, hasFilters, filtered,
    compareList, setCompareList, compareError, toggleCompare,
    rememberList, resetFilters,
  } = filters;
  const [copied, setCopied] = useState(false);
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

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
              <button onClick={copyLink} style={{ background: 'none', border: 'none', color: copied ? '#4a9e3a' : 'var(--text-dim)', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
                {copied ? '✓ 복사됨' : '🔗 링크 복사'}
              </button>
              <button onClick={resetFilters} style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
                ← 홈으로
              </button>
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="empty-state">조건에 맞는 게임이 없어요.</div>
          ) : (
            <div className="grid">
              {filtered.map((game) => {
                const price = getPriceInfo(game);
                const isSelected = compareList.find(g => g.id === game.id);
                return (
                  <Link href={`/games/${game.id}`} key={game.id} className="card" onClick={rememberList} style={isSelected ? { outline: '3px solid var(--accent)', outlineOffset: 2 } : undefined}>
                    <div className="card-image-wrap">
                      <img src={(game.card_image_url || game.cover_image_url)} alt={game.name} />
                      {/* COMPARE_V2 */}
                      <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleCompare(game); }}
                        aria-pressed={!!isSelected}
                        style={{
                          position: 'absolute', top: 10, right: 10, zIndex: 2,
                          padding: '5px 11px', borderRadius: 100, fontSize: 14, fontWeight: 700,
                          border: 'none', cursor: 'pointer',
                          background: isSelected ? 'var(--accent)' : 'rgba(0,0,0,0.6)',
                          color: '#fff',
                          opacity: !isSelected && compareList.length >= 3 ? 0.4 : 1,
                        }}
                      >
                        {isSelected ? '✓ 비교' : '+ 비교'}
                      </button>
                      <span className="platform-badge">{game.steam_appid ? 'Steam' : (({ epic: 'Epic', battlenet: 'Battle.net', riot: 'Riot' } as Record<string, string>)[game.source] ?? 'PC') /* STORE_BADGE */}</span>
                      {(() => {
                        const timing = getPriceTiming(game);
                        if (!timing) return null;
                        return (
                          <span className={`timing-badge ${timing}`}>
                            {timing === 'best' ? '🔥 역대 최저가' : '💰 최저가 근접'}
                          </span>
                        );
                      })()}
                    </div>
                    <div className="card-body">
                      <h3>{game.name}</h3>
                      <p className="card-meta">
                        {game.recommended_players ? `추천 ${game.recommended_players}` : game.min_players && game.max_players ? `${game.min_players}-${game.max_players}인` : ''}
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
          <button onClick={() => setCompareList([])} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', fontSize: 15, cursor: 'pointer', flexShrink: 0 }}>
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
