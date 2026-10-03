// 담당: 친구(검색·태그·비교)
'use client';

import { useState } from 'react';
import AIRecommend from '../AIRecommend';
import SearchBox from './SearchBox';
import { TAG_GROUPS } from '../../lib/tagGroups';
import { translateTag } from '../../lib/tagTranslate';
import type { GameFilters } from '../../lib/useGameFilters';

const CATEGORIES = ['파티', '협동', '퍼즐', '서바이벌'];
const PLAYER_OPTIONS = ['1인', '2인', '3-4인', '5인 이상', '16명 이상'];
const DIFFICULTY_OPTIONS = ['쉬움', '보통', '어려움'];

export default function SearchPanel({ games, filters }: { games: any[], filters: GameFilters }) {
  const {
    submitSearch,
    filterOpen, setFilterOpen,
    selectedCategory, setSelectedCategory,
    selectedTags, toggleTag,
    selectedPlayers, setSelectedPlayers,
    selectedDifficulty, setSelectedDifficulty,
    freeOnly, setFreeOnly,
    saleOnly, setSaleOnly,
    selectedCount, hasFilters, resetFilters,
  } = filters;
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);

  const presentTags = new Set(games.flatMap((g) => g.tags || []));

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
              <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-dim)', marginBottom: 8 }}>카테고리</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {CATEGORIES.map(c => (
                  <button key={c} onClick={() => setSelectedCategory(selectedCategory === c ? '' : c)} style={{
                    padding: '6px 14px', borderRadius: 100, fontSize: 15, fontWeight: 600,
                    border: `1.5px solid ${selectedCategory === c ? 'var(--accent)' : 'var(--border)'}`,
                    background: selectedCategory === c ? 'var(--accent)' : 'var(--bg)',
                    color: selectedCategory === c ? '#fff' : 'var(--text)', cursor: 'pointer',
                  }}>{c}</button>
                ))}
              </div>
            </div>

            {/* 인원수 */}
            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-dim)', marginBottom: 8 }}>인원수</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {PLAYER_OPTIONS.map(p => (
                  <button key={p} onClick={() => setSelectedPlayers(selectedPlayers === p ? '' : p)} style={{
                    padding: '6px 14px', borderRadius: 100, fontSize: 15, fontWeight: 600,
                    border: `1.5px solid ${selectedPlayers === p ? 'var(--accent)' : 'var(--border)'}`,
                    background: selectedPlayers === p ? 'var(--accent)' : 'var(--bg)',
                    color: selectedPlayers === p ? '#fff' : 'var(--text)', cursor: 'pointer',
                  }}>{p}</button>
                ))}
              </div>
            </div>

            {/* 난이도 */}
            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-dim)', marginBottom: 8 }}>난이도</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {DIFFICULTY_OPTIONS.map(d => (
                  <button key={d} onClick={() => setSelectedDifficulty(selectedDifficulty === d ? '' : d)} style={{
                    padding: '6px 14px', borderRadius: 100, fontSize: 15, fontWeight: 600,
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
                padding: '6px 14px', borderRadius: 100, fontSize: 15, fontWeight: 600,
                border: `1.5px solid ${freeOnly ? 'var(--accent)' : 'var(--border)'}`,
                background: freeOnly ? 'var(--accent)' : 'var(--bg)',
                color: freeOnly ? '#fff' : 'var(--text)', cursor: 'pointer',
              }}>무료 게임만</button>
              <button onClick={() => setSaleOnly(v => !v)} style={{
                padding: '6px 14px', borderRadius: 100, fontSize: 15, fontWeight: 600, marginLeft: 8,
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
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8, paddingLeft: 4 }}>
                          {availableTags.map(tag => (
                            <button key={tag} onClick={() => toggleTag(tag)} style={{
                              padding: '4px 12px', borderRadius: 100, fontSize: 14, fontWeight: 600,
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
