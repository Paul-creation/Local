// 담당: 친구(검색·태그·비교)
'use client';

import { useState } from 'react';
import AIRecommend from '../AIRecommend';
import SearchBox from './SearchBox';
import TagHelp from './TagHelp';
import RangeSlider from './RangeSlider';
import { TAG_GROUPS } from '../../lib/tagGroups';
import { translateTag } from '../../lib/tagTranslate';
import type { GameFilters } from '../../lib/useGameFilters';
import { PLAYERS_MAX, PRICE_MAX, PRICE_ALL, FREE_ONLY, isAll, playersLabel, priceLabel } from '../../lib/rangeFilter';

// 배지(category) 값으로 거름 — '협동'·'대전'은 '협동·대전' 게임도 포함 (app/lib/badge.mjs)
const CATEGORIES = ['협동', '대전', '혼자'];
const DIFFICULTY_OPTIONS = ['쉬움', '보통', '어려움'];

export default function SearchPanel({ games, presentTags: presentTagList, filters }: { games: any[], presentTags: string[], filters: GameFilters }) {
  const {
    submitSearch,
    filterOpen, setFilterOpen,
    selectedCategory, setSelectedCategory,
    selectedTags, toggleTag,
    playersRange, setPlayersRange,
    selectedDifficulty, setSelectedDifficulty,
    priceRange, setPriceRange,
    saleOnly, setSaleOnly,
    selectedCount, hasFilters, resetFilters,
  } = filters;
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);

  // DB에 실제로 있는 태그만 그룹에 보여준다 (서버에서 미리 계산해 넘김 — app/page.tsx)
  const presentTags = new Set(presentTagList);

  const toggleGroup = (group: string) =>
    setExpandedGroups(prev => prev.includes(group) ? prev.filter(g => g !== group) : [...prev, group]);

  return (
    <>
      {/* 검색창 */}
      <div className="search-row">
        <SearchBox games={games} filters={filters} />
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
            fontSize: 15, fontWeight: 700, color: 'var(--text)',
            cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}
        >
<span>
  태그 선택
  {selectedCount > 0 && (
    <span style={{ marginLeft: 8, background: 'var(--accent)', color: '#fff', borderRadius: 100, fontSize: 14, padding: '2px 8px' }}>
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
              <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-dim)', marginBottom: 8 }}>플레이 방식</p>
              <div className="filter-chips">
                {CATEGORIES.map(c => (
                  <span key={c} className="tag-chip-wrap">
                    <button className="filter-chip" onClick={() => setSelectedCategory(selectedCategory === c ? '' : c)} style={{
                      padding: '6px 14px', borderRadius: 100, fontSize: 15, fontWeight: 600,
                      border: `1.5px solid ${selectedCategory === c ? 'var(--accent)' : 'var(--border)'}`,
                      background: selectedCategory === c ? 'var(--accent)' : 'var(--bg)',
                      color: selectedCategory === c ? '#fff' : 'var(--text)', cursor: 'pointer',
                    }}>{c}</button>
                    <TagHelp tag={c} />
                  </span>
                ))}
              </div>
            </div>

            {/* 인원수 — L명부터 H명까지 전부 가능한 게임 (app/lib/rangeFilter) */}
            <div style={{ marginBottom: 16 }}>
              <RangeSlider
                title="인원수" value={playersRange} max={PLAYERS_MAX} minHigh={1}
                label={playersLabel} onChange={setPlayersRange}
                lowName="최소 인원" highName="최대 인원"
              />
            </div>

            {/* 가격 — 지금 실제 가격(할인가) 기준. "무료만"은 무료~무료로 바로, 한 번 더 누르면 해제 */}
            <div style={{ marginBottom: 16 }}>
              <RangeSlider
                title="가격" value={priceRange} max={PRICE_MAX}
                label={priceLabel} onChange={setPriceRange}
                lowName="최저 가격" highName="최고 가격"
              />
              <button
                type="button"
                className={`range-chip${isAll(priceRange, FREE_ONLY) ? ' on' : ''}`}
                aria-pressed={isAll(priceRange, FREE_ONLY)}
                onClick={() => setPriceRange(isAll(priceRange, FREE_ONLY) ? PRICE_ALL : FREE_ONLY)}
              >무료만</button>
            </div>

            {/* 난이도 */}
            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-dim)', marginBottom: 8 }}>난이도</p>
              <div className="filter-chips">
                {DIFFICULTY_OPTIONS.map(d => (
                  <span key={d} className="tag-chip-wrap">
                    <button className="filter-chip" onClick={() => setSelectedDifficulty(selectedDifficulty === d ? '' : d)} style={{
                      padding: '6px 14px', borderRadius: 100, fontSize: 15, fontWeight: 600,
                      border: `1.5px solid ${selectedDifficulty === d ? 'var(--accent)' : 'var(--border)'}`,
                      background: selectedDifficulty === d ? 'var(--accent)' : 'var(--bg)',
                      color: selectedDifficulty === d ? '#fff' : 'var(--text)', cursor: 'pointer',
                    }}>{d}</button>
                    <TagHelp tag={d} />
                  </span>
                ))}
              </div>
            </div>

            {/* 할인 중 */}
            <div style={{ marginBottom: 16 }}>
              <button className="filter-chip" onClick={() => setSaleOnly(v => !v)} style={{
                padding: '6px 14px', borderRadius: 100, fontSize: 15, fontWeight: 600,
                border: `1.5px solid ${saleOnly ? 'var(--accent)' : 'var(--border)'}`,
                background: saleOnly ? 'var(--accent)' : 'var(--bg)',
                color: saleOnly ? '#fff' : 'var(--text)', cursor: 'pointer',
              }}>지금 할인 중</button>
            </div>

            {/* 태그 그룹 */}
            <div style={{ marginBottom: 20 }}>
              <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-dim)', marginBottom: 12 }}>태그로 찾기</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {Object.entries(TAG_GROUPS).map(([group, tags]) => {
                  const availableTags = tags.filter(t => presentTags.has(t));
                  if (availableTags.length === 0) return null;
                  const selectedInGroup = availableTags.filter(t => selectedTags.includes(t)).length;
                  return (
                    <div key={group}>
                      <button onClick={() => toggleGroup(group)} style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        fontSize: 15, fontWeight: 700, color: 'var(--text)',
                        padding: '4px 0', display: 'flex', alignItems: 'center', gap: 6,
                      }}>
                        {group} {expandedGroups.includes(group) ? '▴' : '▾'}
                        {selectedInGroup > 0 && (
                          <span style={{ background: 'var(--accent)', color: '#fff', borderRadius: 100, fontSize: 13, padding: '1px 7px' }}>
                            {selectedInGroup}
                          </span>
                        )}
                      </button>
                      {expandedGroups.includes(group) && (
                        <div className="filter-chips" style={{ marginTop: 8, paddingLeft: 4 }}>
                          {availableTags.map(tag => (
                            <span key={tag} className="tag-chip-wrap">
                              <button className="filter-chip" onClick={() => toggleTag(tag)} style={{
                                padding: '6px 14px', borderRadius: 100, fontSize: 15, fontWeight: 600,
                                border: `1.5px solid ${selectedTags.includes(tag) ? 'var(--accent)' : 'var(--border)'}`,
                                background: selectedTags.includes(tag) ? 'rgba(0,113,227,0.1)' : 'var(--bg)',
                                color: selectedTags.includes(tag) ? 'var(--accent-deep)' : 'var(--text-dim)',
                                cursor: 'pointer',
                              }}>{translateTag(tag)}</button>
                              <TagHelp tag={tag} />
                            </span>
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
                  fontSize: 15, fontWeight: 700, color: 'var(--text-dim)', cursor: 'pointer',
                }}>초기화</button>
              )}
              <button
                onClick={() => { submitSearch(); setFilterOpen(false); /* SHOW_TOP — 입력해 둔 검색어도 함께 적용 */ }}
                style={{
                  flex: 1, padding: '12px',
                  background: 'var(--accent)', border: 'none',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 15, fontWeight: 800, color: '#fff',
                  cursor: 'pointer',
                }}
              >
                {hasFilters ? '필터 적용해서 찾기 →' : '전체 게임 보기 →'}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
