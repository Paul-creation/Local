// 담당: 친구(검색·태그·비교)
'use client';

import { useState } from 'react';
import TagHelp from './TagHelp';
import RangeSlider from './RangeSlider';
import { BARRIERS, type GameFilters } from '../../lib/useGameFilters';
import { tagKeyLabel } from '../../lib/tagSearch';
import { EXCLUDE_TAG_IDS, type TagTree } from '../../lib/tagTree';
import {
  PLAYERS_MAX, PLAYERS_ALL, PRICE_MAX, PRICE_ALL, FREE_ONLY, isAll, playersLabel, priceLabel, type Range,
} from '../../lib/rangeFilter';

// 배지(category) 값으로 거름 — '협동'·'대전'은 '협동·대전' 게임도 포함 (app/lib/badge.mjs)
const CATEGORIES = ['협동', '대전', '혼자'];

const rangeText = (r: Range, label: (i: number) => string) => (r[0] === r[1] ? label(r[0]) : `${label(r[0])}~${label(r[1])}`);

// 필터 패널 본문 — 위: 인원·가격·빠른 칩·진입장벽 (항상 보임) / 가운데: 태그 나무 아코디언 / 아래: 빼고 보기
// 고른 조건은 맨 위 칩으로 모아 보여 주고 하나씩·전부 지울 수 있다. 휴대폰에서는 화면 전체를 덮는 패널
// 필터를 처음 열 때 따로 받는다 (SearchPanel의 dynamic import) — 태그 설명(tag-glossary)·나무 화면 코드를 메인 첫 로드에서 뺌
export default function FilterPanel({ filters }: { filters: GameFilters }) {
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

  const toggleRoot = (id: number) =>
    setOpenRoots(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  // 고른 조건 칩 (누르면 그 조건만 해제)
  const conditions: { key: string; label: string; clear: () => void }[] = [];
  if (selectedCategory) conditions.push({ key: 'cat', label: selectedCategory, clear: () => setSelectedCategory('') });
  if (!isAll(playersRange, PLAYERS_ALL)) conditions.push({ key: 'players', label: `인원 ${rangeText(playersRange, playersLabel)}`, clear: () => setPlayersRange(PLAYERS_ALL) });
  if (soloOnly) conditions.push({ key: 'solo', label: '1인 전용', clear: () => setSoloOnly(false) });
  if (storyOnly) conditions.push({ key: 'story', label: '혼자도 꽉 차게', clear: () => setStoryOnly(false) });
  if (freeOnly) conditions.push({ key: 'price', label: '무료만', clear: () => setPriceRange(PRICE_ALL) });
  else if (!isAll(priceRange, PRICE_ALL)) conditions.push({ key: 'price', label: `가격 ${rangeText(priceRange, priceLabel)}`, clear: () => setPriceRange(PRICE_ALL) });
  if (saleOnly) conditions.push({ key: 'sale', label: '할인 중', clear: () => setSaleOnly(false) });
  for (const b of selectedBarriers) conditions.push({ key: `b${b}`, label: `진입장벽 ${b}`, clear: () => toggleBarrier(b) });
  for (const t of selectedTags) conditions.push({ key: `t${t}`, label: tagKeyLabel(t, tree) || '알 수 없는 태그', clear: () => toggleTag(t) });
  for (const t of excludedTags) conditions.push({ key: `x${t}`, label: `${tagKeyLabel(t, tree)} 빼고`, clear: () => toggleExcluded(t) });

  const roots = tree ? tree.roots.filter((id) => id !== tree.contentId && tagCounts.get(id)) : [];
  const excludable = tree ? EXCLUDE_TAG_IDS.filter((id) => tree.nodes.has(id) && tagCounts.get(id)) : [];

  return (
    <div id="filter-panel" className="filter-panel" role="region" aria-label="필터">
      {/* 휴대폰 전체 화면일 때만 보이는 머리줄 */}
      <div className="filter-head">
        <strong>필터</strong>
        <button type="button" className="filter-close" onClick={() => setFilterOpen(false)} aria-label="필터 닫기">✕</button>
      </div>

      <div className="filter-body">
        {/* 고른 조건 */}
        {conditions.length > 0 && (
          <div className="filter-selected">
            {conditions.map((c) => (
              <button key={c.key} type="button" className="filter-selected-chip" onClick={c.clear} aria-label={`${c.label} 조건 지우기`}>
                {c.label} <span aria-hidden="true">✕</span>
              </button>
            ))}
            <button type="button" className="filter-clear-all" onClick={clearConditions}>전체 지우기</button>
          </div>
        )}

        {/* 위 고정: 협동·대전·혼자 / 인원 / 가격 / 빠른 칩 / 진입장벽 */}
        <section className="filter-section">
          <p className="filter-label">같이 하는 방식</p>
          <div className="filter-chips">
            {CATEGORIES.map(c => (
              <span key={c} className="tag-chip-wrap">
                <button type="button" className={`range-chip filter-pill${selectedCategory === c ? ' on' : ''}`} aria-pressed={selectedCategory === c}
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
        </section>

        {/* 가격 — 지금 실제 가격(할인가) 기준 */}
        <section className="filter-section">
          <RangeSlider
            title="가격" value={priceRange} max={PRICE_MAX}
            label={priceLabel} onChange={setPriceRange}
            lowName="최저 가격" highName="최고 가격"
          />
        </section>

        <section className="filter-section">
          <div className="filter-chips">
            <button type="button" className={`range-chip filter-pill${soloOnly ? ' on' : ''}`} aria-pressed={soloOnly} onClick={() => setSoloOnly(!soloOnly)}>1인 전용</button>
            <span className="tag-chip-wrap">
              <button type="button" className={`range-chip filter-pill${storyOnly ? ' on' : ''}`} aria-pressed={storyOnly} onClick={() => setStoryOnly(!storyOnly)}>혼자도 꽉 차게</button>
              <TagHelp tag="혼자도 꽉 차게" />
            </span>
            <button type="button" className={`range-chip filter-pill${freeOnly ? ' on' : ''}`} aria-pressed={freeOnly} onClick={() => setPriceRange(freeOnly ? PRICE_ALL : FREE_ONLY)}>무료만</button>
            <button type="button" className={`range-chip filter-pill${saleOnly ? ' on' : ''}`} aria-pressed={saleOnly} onClick={() => setSaleOnly(v => !v)}>할인 중</button>
          </div>
        </section>

        <section className="filter-section">
          <p className="filter-label">
            진입장벽 <TagHelp tag="진입장벽" />
          </p>
          <div className="filter-chips">
            {BARRIERS.map(([ko]) => (
              <button key={ko} type="button" className={`range-chip filter-pill${selectedBarriers.includes(ko) ? ' on' : ''}`} aria-pressed={selectedBarriers.includes(ko)}
                onClick={() => toggleBarrier(ko)}>{ko}</button>
            ))}
          </div>
        </section>

        {/* 태그 나무 — 큰 칸을 고르면 그 아래 태그 중 하나라도 있는 게임, 서로 다른 칸끼리는 모두 만족 */}
        <section className="filter-section">
          <p className="filter-label">태그</p>
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
                      <span>{node.ko}{picked > 0 && <span className="filter-count">{picked}</span>}</span>
                      <span aria-hidden="true">{open ? '▴' : '▾'}</span>
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

      <div className="filter-foot">
        {selectedCount > 0 && (
          <button type="button" className="filter-foot-clear" onClick={clearConditions}>전체 지우기</button>
        )}
        <button
          type="button"
          className="filter-apply"
          onClick={() => { submitSearch(); setFilterOpen(false); /* SHOW_TOP — 입력해 둔 검색어도 함께 적용 */ }}
        >
          {!loaded ? '결과 보기 →' : selectedCount > 0 ? `${filtered.length.toLocaleString('ko-KR')}개 게임 보기 →` : '전체 게임 보기 →'}
        </button>
      </div>
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
            {open ? '−' : '+'}
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
