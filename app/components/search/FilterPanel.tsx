// 담당: 친구(검색·태그·비교)
'use client';

import { useState } from 'react';
import TagHelp from './TagHelp';
import RangeSlider from './RangeSlider';
import { BARRIERS, type GameFilters } from '../../lib/useGameFilters';
import { EXCLUDE_TAG_IDS, type TagTree } from '../../lib/tagTree';
import { PLAYERS_MAX, PRICE_MAX, PRICE_ALL, FREE_ONLY, isAll, playersLabel, priceLabel } from '../../lib/rangeFilter';

// 배지(category) 값으로 거름 — '협동'·'대전'은 '협동·대전' 게임도 포함 (app/lib/badge.mjs)
const CATEGORIES = ['협동', '대전', '혼자'];

// 필터 카드 — "필터" + 전체 지우기 / 같이 하는 방식 / 인원 + 1인 전용·혼자도 꽉 차게 / 가격 + 무료만·지금 할인 중 /
// 진입장벽 3칸 / 분류 아코디언 / 빼고 보기
// variant: sheet = 메인에서 펼치는 카드 (휴대폰은 화면 전체를 덮고 아래 "N개 게임 보기"), sidebar = 데스크톱 결과 왼쪽 칸
// 필터를 처음 열 때 따로 받는다 (SearchPanel·GameGrid의 dynamic import) — 태그 설명·나무 화면 코드를 메인 첫 로드에서 뺌
export default function FilterPanel({ filters, variant = 'sheet' }: { filters: GameFilters; variant?: 'sheet' | 'sidebar' }) {
  const {
    submitSearch,
    setFilterOpen,
    selectedCategory, setSelectedCategory,
    selectedTags, toggleTag, tagCounts, tree,
    excludedTags, toggleExcluded,
    selectedBarriers, toggleBarrier,
    storyOnly, setStoryOnly,
    playersRange, setPlayersRange,
    soloOnly, setSoloOnly,
    priceRange, setPriceRange,
    saleOnly, setSaleOnly,
    selectedCount, clearConditions, filtered, loaded,
  } = filters;
  const [openRoots, setOpenRoots] = useState<number[]>([]);
  const freeOnly = isAll(priceRange, FREE_ONLY);
  const sheet = variant === 'sheet';

  const toggleRoot = (id: number) =>
    setOpenRoots(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const roots = tree ? tree.roots.filter((id) => id !== tree.contentId && tagCounts.get(id)) : [];
  const excludable = tree ? EXCLUDE_TAG_IDS.filter((id) => tree.nodes.has(id) && tagCounts.get(id)) : [];

  return (
    <div id="filter-panel" className={`filter-panel is-${variant}`} role="region" aria-label="필터">
      <div className="filter-head">
        <strong className="filter-head-title">필터</strong>
        {selectedCount > 0 && <button type="button" className="filter-clear-all" onClick={clearConditions}>전체 지우기</button>}
        {sheet && <button type="button" className="filter-close" onClick={() => setFilterOpen(false)} aria-label="필터 닫기">×</button>}
      </div>

      <div className="filter-body">
        <section className="filter-section">
          <p className="filter-label">같이 하는 방식</p>
          <div className="filter-chips">
            {CATEGORIES.map(c => (
              <span key={c} className="tag-chip-wrap">
                <button type="button" className={`chip${selectedCategory === c ? ' on' : ''}`} aria-pressed={selectedCategory === c}
                  onClick={() => setSelectedCategory(selectedCategory === c ? '' : c)}>{c}</button>
                <TagHelp tag={c} />
              </span>
            ))}
          </div>
        </section>

        {/* 인원 — 친구랑 같이 할 수 있는 인원(팀 인원, 없으면 최대 인원) 기준 (app/lib/rangeFilter) */}
        <section className="filter-section">
          <RangeSlider
            title="인원" value={playersRange} max={PLAYERS_MAX} minHigh={1}
            label={playersLabel} onChange={setPlayersRange}
            lowName="최소 인원" highName="최대 인원"
          />
          <div className="filter-chips">
            <button type="button" className={`chip${soloOnly ? ' on' : ''}`} aria-pressed={soloOnly} onClick={() => setSoloOnly(!soloOnly)}>1인 전용</button>
            <span className="tag-chip-wrap">
              <button type="button" className={`chip${storyOnly ? ' on' : ''}`} aria-pressed={storyOnly} onClick={() => setStoryOnly(!storyOnly)}>혼자도 꽉 차게</button>
              <TagHelp tag="혼자도 꽉 차게" />
            </span>
          </div>
        </section>

        {/* 가격 — 지금 실제 가격(할인가) 기준 */}
        <section className="filter-section">
          <RangeSlider
            title="가격" value={priceRange} max={PRICE_MAX}
            label={priceLabel} onChange={setPriceRange}
            lowName="최저 가격" highName="최고 가격"
          />
          <p className="filter-note">할인 중이면 할인가 기준</p>
          <div className="filter-chips">
            <button type="button" className={`chip${freeOnly ? ' on' : ''}`} aria-pressed={freeOnly} onClick={() => setPriceRange(freeOnly ? PRICE_ALL : FREE_ONLY)}>무료만</button>
            <button type="button" className={`chip${saleOnly ? ' on' : ''}`} aria-pressed={saleOnly} onClick={() => setSaleOnly(v => !v)}>지금 할인 중</button>
          </div>
        </section>

        {/* 진입장벽 — 3칸 버튼 (여러 개 고르면 그중 하나) */}
        <section className="filter-section">
          <p className="filter-label">진입장벽 <TagHelp tag="진입장벽" /></p>
          <div className="seg" role="group" aria-label="진입장벽">
            {BARRIERS.map(([ko]) => (
              <button key={ko} type="button" className={`seg-btn${selectedBarriers.includes(ko) ? ' on' : ''}`} aria-pressed={selectedBarriers.includes(ko)}
                onClick={() => toggleBarrier(ko)}>{ko}</button>
            ))}
          </div>
        </section>

        {/* 분류 — 큰 칸을 고르면 그 아래 태그 중 하나라도 있는 게임, 서로 다른 칸끼리는 모두 만족 */}
        <section className="filter-section">
          <p className="filter-label">분류</p>
          {!tree ? (
            <p className="filter-note">{loaded ? '태그 목록을 불러오지 못했어요' : '태그 목록 불러오는 중…'}</p>
          ) : roots.length === 0 ? (
            <p className="filter-note">태그 정보를 준비하고 있어요</p>
          ) : (
            <div className="filter-accordion">
              {roots.map((id) => {
                const node = tree.nodes.get(id)!;
                const open = openRoots.includes(id);
                const picked = selectedTags.filter((t) => isUnder(tree, Number(t), id)).length;
                return (
                  <div key={id} className="filter-acc-item">
                    <button type="button" className="filter-acc-head" aria-expanded={open} onClick={() => toggleRoot(id)}>
                      <span className="filter-acc-name">{node.ko}</span>
                      {picked > 0 && <span className="badge badge-accent">{picked}개 선택</span>}
                      <span className="filter-acc-state">{open ? '접기' : '펼치기'}</span>
                    </button>
                    {open && (
                      <ul className="tag-tree" role="group">
                        {node.children.filter((c) => tagCounts.get(c)).map((c) => (
                          <TagRow key={c} id={c} tree={tree} counts={tagCounts} selected={selectedTags} onToggle={toggleTag} />
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* 빼고 보기 — 이용 연령·표현 */}
        {excludable.length > 0 && (
          <section className="filter-section">
            <p className="filter-label">빼고 보기</p>
            <ul className="tag-tree">
              {excludable.map((id) => {
                const key = String(id);
                const on = excludedTags.includes(key);
                return (
                  <li key={id}>
                    <div className="tag-row">
                      <label className="tag-check">
                        <input type="checkbox" checked={on} onChange={() => toggleExcluded(key)} />
                        <span className="tag-check-name">{tree!.nodes.get(id)!.ko} 있는 게임 빼기</span>
                        <span className="tag-check-count">{tagCounts.get(id)}</span>
                        <TagHelp tag={tree!.nodes.get(id)!.ko} />
                      </label>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>

      {sheet && (
        <div className="filter-foot">
          <button
            type="button"
            className="btn btn-primary btn-lg filter-apply"
            onClick={() => { submitSearch(); setFilterOpen(false); /* SHOW_TOP — 입력해 둔 검색어도 함께 적용 */ }}
          >
            {!loaded ? '결과 보기 →' : selectedCount > 0 ? `${filtered.length.toLocaleString('ko-KR')}개 게임 보기 →` : '전체 게임 보기 →'}
          </button>
        </div>
      )}
    </div>
  );
}

// id가 root 아래(또는 root 자신)인지
function isUnder(tree: TagTree, id: number, root: number) {
  for (let cur: number | null = id; cur != null; cur = tree.nodes.get(cur)?.parent ?? null) if (cur === root) return true;
  return false;
}

// 태그 한 줄 (체크 + 이름 + 게임 수 + 아래 칸 펼치기). 게임이 0개인 칸은 그리지 않음
function TagRow({ id, tree, counts, selected, onToggle }: {
  id: number; tree: TagTree; counts: Map<number, number>; selected: string[]; onToggle: (key: string) => void;
}) {
  const node = tree.nodes.get(id)!;
  const kids = node.children.filter((c) => counts.get(c));
  // 아래 칸 중 고른 게 있으면 처음부터 펼쳐 둔다
  const [open, setOpen] = useState(() => selected.some((t) => Number(t) !== id && isUnder(tree, Number(t), id)));
  const key = String(id);
  return (
    <li>
      <div className="tag-row">
        <label className="tag-check">
          <input type="checkbox" checked={selected.includes(key)} onChange={() => onToggle(key)} />
          <span className="tag-check-name">{node.ko}</span>
          <span className="tag-check-count">{counts.get(id)}</span>
          {/* 라벨 안의 버튼은 눌러도 체크가 바뀌지 않음 (설명만 열림) */}
          <TagHelp tag={node.ko} />
        </label>
        {kids.length > 0 && (
          <button type="button" className="tag-expand" aria-expanded={open} aria-label={`${node.ko} 아래 태그 ${open ? '접기' : '펼치기'}`} onClick={() => setOpen((v) => !v)}>
            {open ? '접기' : '펼치기'}
          </button>
        )}
      </div>
      {open && kids.length > 0 && (
        <ul className="tag-tree" role="group">
          {kids.map((c) => <TagRow key={c} id={c} tree={tree} counts={counts} selected={selected} onToggle={onToggle} />)}
        </ul>
      )}
    </li>
  );
}
