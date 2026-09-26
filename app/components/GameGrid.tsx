'use client';

import Link from 'next/link';
import { useState } from 'react';
import BannerCarousel from './BannerCarousel';
import AIRecommend from './AIRecommend';
import { getPriceInfo } from '../lib/price';
import { TAG_GROUPS } from '../lib/tagGroups';
import DiscountSection from './DiscountSection';
import { translateTag } from '../lib/tagTranslate';

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

const CATEGORIES = ['파티', '협동', '퍼즐', '서바이벌'];
const PLAYER_OPTIONS = ['1인', '2인', '3-4인', '5인 이상'];
const DIFFICULTY_OPTIONS = ['쉬움', '보통', '어려움'];

export default function GameGrid({ games, hideHero = false }: { games: any[], hideHero?: boolean }) {
  const [showResults, setShowResults] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedPlayers, setSelectedPlayers] = useState('');
  const [selectedDifficulty, setSelectedDifficulty] = useState('');
  const [freeOnly, setFreeOnly] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);
  const [compareList, setCompareList] = useState<any[]>([]);
  const [compareError, setCompareError] = useState('');

  const toggleCompare = (game: any) => {
    setCompareList(prev => {
      if (prev.find(g => g.id === game.id)) return prev.filter(g => g.id !== game.id);
      if (prev.length >= 3) return prev;
      if (prev.length > 0) {
        const firstIsSolo = prev[0].max_players === 1;
        const newIsSolo = game.max_players === 1;
        if (firstIsSolo !== newIsSolo) {
          setCompareError(firstIsSolo ? '싱글 게임끼리만 비교할 수 있어요' : '멀티 게임끼리만 비교할 수 있어요');
          setTimeout(() => setCompareError(''), 2000);
          return prev;
        }
      }
      return [...prev, game];
    });
  };

  const featured = games.find((g) => g.featured);
  const bannerPool = games.filter((g) => g.is_casual_party && !g.featured);
  const freeGames = games.filter((g) => g.is_free);
  const hotGames = [...games]
    .filter(g => g.heat_rank)
    .sort((a, b) => a.heat_rank - b.heat_rank)
    .slice(0, 6);

  const presentTags = new Set(games.flatMap((g) => g.tags || []));

  const toggleTag = (tag: string) =>
    setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);

  const toggleGroup = (group: string) =>
    setExpandedGroups(prev => prev.includes(group) ? prev.filter(g => g !== group) : [...prev, group]);

  const normalizedQuery = query.trim().toLowerCase();
  const selectedCount = [selectedCategory, selectedPlayers, selectedDifficulty, freeOnly ? '무료' : '', ...selectedTags].filter(Boolean).length;
  const hasFilters = !!(normalizedQuery || selectedCategory || selectedTags.length > 0 || selectedPlayers || selectedDifficulty || freeOnly);

  const filtered = games.filter((g) => {
    if (freeOnly && !g.is_free) return false;
    if (selectedCategory && g.category !== selectedCategory) return false;
    if (selectedTags.length > 0 && !selectedTags.some(t => g.tags?.includes(t))) return false;
    if (selectedDifficulty && g.difficulty !== selectedDifficulty) return false;
    if (selectedPlayers) {
      if (selectedPlayers === '1인' && !(g.min_players === 1 && g.max_players === 1)) return false;
      if (selectedPlayers === '2인' && !(g.min_players <= 2 && g.max_players >= 2)) return false;
      if (selectedPlayers === '3-4인' && !(g.max_players >= 3)) return false;
      if (selectedPlayers === '5인 이상' && !(g.max_players >= 5)) return false;
    }
    if (normalizedQuery) {
      return g.name.toLowerCase().includes(normalizedQuery) ||
        g.tags?.some((t: string) => t.toLowerCase().includes(normalizedQuery));
    }
    return true;
  });

  const resetFilters = () => {
    setQuery('');
    setSelectedCategory('');
    setSelectedTags([]);
    setSelectedPlayers('');
    setSelectedDifficulty('');
    setFreeOnly(false);
    setShowResults(false);
    setFilterOpen(false);
    setCompareList([]);
  };

  const featuredPrice = featured ? getPriceInfo(featured) : null;

  return (
    <>
      {/* 검색창 */}
      <div className="search-row">
        <div className="search-bar-clean">
          <input
            type="text"
            placeholder="게임 이름으로 검색..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') setShowResults(true); }}
          />
          {query && <button className="search-clear" onClick={() => setQuery('')}>✕</button>}
        </div>
        <AIRecommend />
      </div>

      {/* 게임 찾기 아코디언 */}
      <div style={{ marginBottom: 24 }}>
        <button
          onClick={() => setFilterOpen(v => !v)}
          style={{
            width: '100%', padding: '12px 16px',
            background: 'var(--bg-card)',
            border: '1.5px solid var(--border)',
            borderRadius: filterOpen ? 'var(--radius-md) var(--radius-md) 0 0' : 'var(--radius-md)',
            fontSize: 14, fontWeight: 700, color: 'var(--text)',
            cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}
        >
<span>
  태그 선택
  {selectedCount > 0 && (
    <span style={{ marginLeft: 8, background: 'var(--accent)', color: '#fff', borderRadius: 100, fontSize: 12, padding: '2px 8px' }}>
      {selectedCount}개 선택됨
    </span>
  )}
</span>
          <span>{filterOpen ? '▴' : '▾'}</span>
        </button>

        {filterOpen && (
          <div style={{
            background: 'var(--bg-card)',
            border: '1.5px solid var(--border)', borderTop: 'none',
            borderRadius: '0 0 var(--radius-md) var(--radius-md)',
            padding: 20,
          }}>
            {/* 카테고리 */}
            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-dim)', marginBottom: 8 }}>카테고리</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {CATEGORIES.map(c => (
                  <button key={c} onClick={() => setSelectedCategory(selectedCategory === c ? '' : c)} style={{
                    padding: '6px 14px', borderRadius: 100, fontSize: 13, fontWeight: 600,
                    border: `1.5px solid ${selectedCategory === c ? 'var(--accent)' : 'var(--border)'}`,
                    background: selectedCategory === c ? 'var(--accent)' : 'var(--bg)',
                    color: selectedCategory === c ? '#fff' : 'var(--text)', cursor: 'pointer',
                  }}>{c}</button>
                ))}
              </div>
            </div>

            {/* 인원수 */}
            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-dim)', marginBottom: 8 }}>인원수</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {PLAYER_OPTIONS.map(p => (
                  <button key={p} onClick={() => setSelectedPlayers(selectedPlayers === p ? '' : p)} style={{
                    padding: '6px 14px', borderRadius: 100, fontSize: 13, fontWeight: 600,
                    border: `1.5px solid ${selectedPlayers === p ? 'var(--accent)' : 'var(--border)'}`,
                    background: selectedPlayers === p ? 'var(--accent)' : 'var(--bg)',
                    color: selectedPlayers === p ? '#fff' : 'var(--text)', cursor: 'pointer',
                  }}>{p}</button>
                ))}
              </div>
            </div>

            {/* 난이도 */}
            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-dim)', marginBottom: 8 }}>난이도</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {DIFFICULTY_OPTIONS.map(d => (
                  <button key={d} onClick={() => setSelectedDifficulty(selectedDifficulty === d ? '' : d)} style={{
                    padding: '6px 14px', borderRadius: 100, fontSize: 13, fontWeight: 600,
                    border: `1.5px solid ${selectedDifficulty === d ? 'var(--accent)' : 'var(--border)'}`,
                    background: selectedDifficulty === d ? 'var(--accent)' : 'var(--bg)',
                    color: selectedDifficulty === d ? '#fff' : 'var(--text)', cursor: 'pointer',
                  }}>{d}</button>
                ))}
              </div>
            </div>

            {/* 무료만 */}
            <div style={{ marginBottom: 16 }}>
              <button onClick={() => setFreeOnly(v => !v)} style={{
                padding: '6px 14px', borderRadius: 100, fontSize: 13, fontWeight: 600,
                border: `1.5px solid ${freeOnly ? 'var(--accent)' : 'var(--border)'}`,
                background: freeOnly ? 'var(--accent)' : 'var(--bg)',
                color: freeOnly ? '#fff' : 'var(--text)', cursor: 'pointer',
              }}>무료 게임만</button>
            </div>

            {/* 태그 그룹 */}
            <div style={{ marginBottom: 20 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-dim)', marginBottom: 12 }}>태그로 찾기</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {Object.entries(TAG_GROUPS).map(([group, tags]) => {
                  const availableTags = tags.filter(t => presentTags.has(t));
                  if (availableTags.length === 0) return null;
                  const selectedInGroup = availableTags.filter(t => selectedTags.includes(t)).length;
                  return (
                    <div key={group}>
                      <button onClick={() => toggleGroup(group)} style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        fontSize: 13, fontWeight: 700, color: 'var(--text)',
                        padding: '4px 0', display: 'flex', alignItems: 'center', gap: 6,
                      }}>
                        {group} {expandedGroups.includes(group) ? '▴' : '▾'}
                        {selectedInGroup > 0 && (
                          <span style={{ background: 'var(--accent)', color: '#fff', borderRadius: 100, fontSize: 11, padding: '1px 7px' }}>
                            {selectedInGroup}
                          </span>
                        )}
                      </button>
                      {expandedGroups.includes(group) && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8, paddingLeft: 4 }}>
                          {availableTags.map(tag => (
                            <button key={tag} onClick={() => toggleTag(tag)} style={{
                              padding: '4px 12px', borderRadius: 100, fontSize: 12, fontWeight: 600,
                              border: `1.5px solid ${selectedTags.includes(tag) ? 'var(--accent)' : 'var(--border)'}`,
                              background: selectedTags.includes(tag) ? 'rgba(0,113,227,0.1)' : 'var(--bg)',
                              color: selectedTags.includes(tag) ? 'var(--accent)' : 'var(--text-dim)',
                              cursor: 'pointer',
                            }}>{translateTag(tag)}</button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

                        {/* 버튼들 */}
            <div style={{ display: 'flex', gap: 8 }}>
              {hasFilters && (
                <button onClick={resetFilters} style={{
                  padding: '12px 16px', borderRadius: 'var(--radius-md)',
                  border: '1.5px solid var(--border)', background: 'var(--bg)',
                  fontSize: 14, fontWeight: 700, color: 'var(--text-dim)', cursor: 'pointer',
                }}>초기화</button>
              )}
              <button
                onClick={() => { setShowResults(true); setFilterOpen(false); }}
                style={{
                  flex: 1, padding: '12px',
                  background: 'var(--accent)', border: 'none',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 14, fontWeight: 800, color: '#fff',
                  cursor: 'pointer',
                }}
              >
                {hasFilters ? '필터 적용해서 찾기 →' : '전체 게임 보기 →'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 히어로/섹션 — 결과 없을 때만 */}
      {!hideHero && !showResults && !normalizedQuery && (
        <>
                    {featured && (
            <Link href={`/games/${featured.id}`} className="hero-card">
              <div className="hero-image-wrap">
                <img src={featured.cover_image_url} alt={featured.name} />
              </div>
              <div className="hero-content">
                <span className="hero-badge">🔥 이번주의 게임</span>
                <h2>{featured.name}</h2>
                <p className="hero-tagline">이번주에 가장 인기있던 작품, 친구들하고 어때요?</p>
                <div className="hero-meta">
                  {featured.min_players && featured.max_players ? `${featured.min_players}-${featured.max_players}인` : ''}
                  {featured.difficulty ? ` · ${featured.difficulty}` : ''}
                </div>
                {featured.tags?.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {featured.tags.slice(0, 4).map((tag: string) => (
                      <span key={tag} className="category-tag">{tag}</span>
                    ))}
                  </div>
                )}
                {featured.description && (
  <p style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.6, margin: 0 }}>
    {featured.description.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#39;/g, "'").slice(0, 120)}...
  </p>
)}
                {featuredPrice && (
                  <div className="price-row">
                    {featuredPrice.discount > 0 && (
                      <>
                        <span className="discount-badge">-{featuredPrice.discount}%</span>
                        <span className="price-original">{featuredPrice.formattedOriginal}</span>
                      </>
                    )}
                    <span className="price-final">{featuredPrice.formattedFinal}</span>
                  </div>
                )}
              </div>
            </Link>
          )}

          {bannerPool.length > 0 && (
            <>
              <div className="section-label">🎯 추천 게임</div>
              <BannerCarousel games={bannerPool} />
            </>
          )}

      

          {freeGames.length > 0 && (
            <section className="free-section">
              <div className="section-header">
                <h2 className="section-title">🆓 지금 무료로 즐길 수 있는 게임</h2>
                <span className="section-sub">설치만 하면 바로 친구랑 시작 가능</span>
              </div>
              <div className="free-strip">
                {freeGames.map((g) => (
                  <a href={`/games/${g.id}`} key={g.id} className="free-chip">
                    <img src={g.cover_image_url} alt={g.name} />
                    <span>{g.name}</span>
                  </a>
                ))}
              </div>
            </section>
          )}

          {hotGames.length > 0 && (
            <div style={{ marginBottom: 32 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 16 }}>인기 급상승</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                {hotGames.map((game, i) => (
                  <Link href={`/games/${game.id}`} key={game.id} style={{ textDecoration: 'none' }}>
                   <div style={{
  display: 'flex', alignItems: 'center', gap: 16,
  background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)',
  padding: '18px 20px', border: '1px solid var(--border-light)',
  boxShadow: '0 2px 8px rgba(0,0,0,0.10)',
}}>
                      <span style={{ fontSize: 24, fontWeight: 900, color: 'var(--text-dimmer)', width: 32, flexShrink: 0, textAlign: 'center' }}>
    {i + 1}
  </span>
  <img src={game.cover_image_url} alt={game.name} style={{ width: 96, aspectRatio: '460 / 215', objectFit: 'cover', borderRadius: 8, flexShrink: 0 }} />
  <div style={{ minWidth: 0 }}>
    <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{game.name}</div>
    <div style={{ fontSize: 13, color: 'var(--text-dimmer)' }}>
      {game.min_players && game.max_players ? `${game.min_players}-${game.max_players}인` : ''}
      {game.difficulty ? ` · ${game.difficulty}` : ''}
    </div>
  </div>
</div>
                  </Link>
                ))}
              </div>
            </div>
                    )}

          <DiscountSection games={games} />
        </>
      )}

      {/* 결과 */}
      {(showResults || normalizedQuery) && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ fontSize: 14, color: 'var(--text-dim)' }}>
              <strong style={{ color: 'var(--text)' }}>{filtered.length}개</strong> 게임
              {hasFilters && ' · 필터 적용됨'}
              {filtered.length >= 2 && (
                <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--text-dimmer)' }}>
                  카드의 <b>+ 비교</b>로 최대 3개까지 비교해보세요
                </span>
              )}
            </div>
            <button onClick={resetFilters} style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              ← 홈으로
            </button>
          </div>

          {filtered.length === 0 ? (
            <div className="empty-state">조건에 맞는 게임이 없어요.</div>
          ) : (
            <div className="grid">
              {filtered.map((game) => {
                const price = getPriceInfo(game);
                const isSelected = compareList.find(g => g.id === game.id);
                return (
                  <Link href={`/games/${game.id}`} key={game.id} className="card" style={isSelected ? { outline: '3px solid var(--accent)', outlineOffset: 2 } : undefined}>
                    <div className="card-image-wrap">
                      <img src={game.cover_image_url} alt={game.name} />
                      {/* COMPARE_V2 */}
                      <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleCompare(game); }}
                        aria-pressed={!!isSelected}
                        style={{
                          position: 'absolute', top: 10, right: 10, zIndex: 2,
                          padding: '5px 11px', borderRadius: 100, fontSize: 12, fontWeight: 700,
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
                          <span style={{ marginLeft: 6, color: 'var(--danger)', fontSize: 11, fontWeight: 700 }}>멀티필수</span>
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

      {(showResults || normalizedQuery) && (compareList.length > 0 || compareError) && (
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
              <span style={{ fontSize: 13, color: '#ff6b6b' }}>{compareError}</span>
            ) : compareList.length === 0 ? (
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>게임을 선택하세요 (최대 3개)</span>
            ) : (
              compareList.map(g => (
                <span key={g.id} style={{
                  fontSize: 12, background: 'rgba(255,255,255,0.15)',
                  padding: '4px 10px', borderRadius: 100,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 130,
                }}>{g.name}</span>
              ))
            )}
          </div>
          <button onClick={() => setCompareList([])} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', fontSize: 13, cursor: 'pointer', flexShrink: 0 }}>
            초기화
          </button>
          {compareList.length >= 2 ? (
            <a href={`/compare?ids=${compareList.map(g => g.id).join(',')}`} style={{
              background: 'var(--accent)', color: '#fff',
              padding: '8px 18px', borderRadius: 100,
              fontSize: 13, fontWeight: 700, textDecoration: 'none', flexShrink: 0,
            }}>
              비교하기 ({compareList.length}개)
            </a>
          ) : (
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', flexShrink: 0 }}>2개 이상 선택</span>
          )}
        </div>
      )}
    </>
  );
}