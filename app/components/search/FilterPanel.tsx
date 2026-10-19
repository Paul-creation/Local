// 담당: 친구(검색·태그·비교)
'use client';

import { useState, type ReactNode } from 'react';
import TagHelp, { getTagDescription } from './TagHelp';
import { useChipHint } from './ChipHint';
import RangeSlider from './RangeSlider';
import MyPcLink from '../pcspec/MyPcLink';
import { BARRIERS, NETS, type GameFilters } from '../../lib/useGameFilters';
import { TRENDS } from '../../lib/trendFilter';
import { EXCLUDE_TAG_IDS, type TagTree } from '../../lib/tagTree';
import { ACTIVITY_BY_GROUP } from '../../lib/activitySearch';
import { activityForTag } from '../../lib/activities';
import { PLAYERS_MAX, PRICE_MAX, PRICE_ALL, FREE_ONLY, isAll, playersLabel, priceLabel } from '../../lib/rangeFilter';

// 배지(category) 값으로 거름 — '협동'·'대전'은 '협동·대전' 게임도 포함 (app/lib/badge.mjs)
const CATEGORIES = ['협동', '대전', '혼자'];

// 분류 큰 칸 안의 태그는 처음 이만큼만 보이고 나머지는 "더 보기"
const MORE_LIMIT = 6;

// 그룹별 안내 문구 (용어집 tag-glossary.json 기준, 없는 칩만 여기서 적음)
const PLAY_DESCS = Object.fromEntries(CATEGORIES.map((c) => [c, getTagDescription(c)]));
const SOLO_DESCS: Record<string, string> = {
  '1인 전용': '혼자서만 하는 1인용 게임만 보여줘요',
  '2인 전용': '최대 2명까지만 같이 하는 게임만 보여줘요',
  '8인 이상': '최대 8명 이상이 같이 하는 게임만 보여줘요',
  '혼자도 충분': getTagDescription('혼자도 충분'),
};
const BARRIER_DESCS: Record<string, string> = {
  '낮음': '설명 없이 바로 시작해서 같이 즐길 수 있어요',
  '보통': '조금 익히면 같이 즐길 수 있어요',
  '높음': '조작·규칙을 꽤 배워야 같이 즐길 수 있어요',
};

// 필터 카드 — "필터" + 전체 지우기 / 같이 하는 방식 / 인원 + 1인 전용·혼자도 충분 / 가격 + 무료만·지금 할인 중 /
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
    selectedNet, toggleNet,
    selectedTrend, toggleTrend,
    selectedActs, toggleAct, actIncludeUnsure, setActIncludeUnsure, actCounts,
    playersRange, setPlayersRange,
    soloOnly, setSoloOnly,
    duoOnly, setDuoOnly,
    largeOnly, setLargeOnly,
    priceRange, setPriceRange,
    saleOnly, setSaleOnly,
    myPcOnly, setMyPcOnly, myPc, myPcReady,
    hideOwned, setHideOwned, ownedAvailable,
    selectedCount, clearConditions, filtered, loaded,
  } = filters;
  const [openRoots, setOpenRoots] = useState<number[]>([]);
  const [moreRoots, setMoreRoots] = useState<number[]>([]);
  const playHint = useChipHint(PLAY_DESCS, '방식을 누르면 설명이 나와요');
  const soloHint = useChipHint(SOLO_DESCS, '버튼을 누르면 설명이 나와요');
  const barrierHint = useChipHint(BARRIER_DESCS, '단계를 누르면 설명이 나와요');
  const freeOnly = isAll(priceRange, FREE_ONLY);
  const sheet = variant === 'sheet';

  // 1인 전용·2인 전용·8인 이상은 최대 인원 조건이라 동시에 걸 수 없다 — 하나를 켜면 나머지는 끈다
  const pickMax = (which: 'solo' | 'duo' | 'large') => {
    setSoloOnly(which === 'solo' && !soloOnly);
    setDuoOnly(which === 'duo' && !duoOnly);
    setLargeOnly(which === 'large' && !largeOnly);
  };

  const toggleRoot = (id: number) =>
    setOpenRoots(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const toggleMore = (id: number) =>
    setMoreRoots(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

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
        {/* 내 PC로 돌아가는 게임만 — 맨 위(인원보다 위). 최소 사양 미달만 뺀다 (app/lib/specJudge.runsOnMyPc). 사양은 브라우저에만 저장, 등록·수정은 /my-pc */}
        {(myPcReady || ownedAvailable) && (
          <section className="filter-section">
            {(myPc || ownedAvailable) && (
              <div className="filter-chips">
                {myPc && <button type="button" className={`chip${myPcOnly ? ' on' : ''}`} aria-pressed={myPcOnly} onClick={() => setMyPcOnly((v) => !v)}>내 PC로 돌아가는 게임만</button>}
                {/* 보유 게임 빼고 보기 — 로그인했고 공개 보유 목록이 있을 때만. 선택은 브라우저에만 저장(jdn_hide_owned), 주소엔 안 담음 */}
                {ownedAvailable && <button type="button" className={`chip${hideOwned ? ' on' : ''}`} aria-pressed={hideOwned} onClick={() => setHideOwned(!hideOwned)}>보유 게임 빼고 보기</button>}
              </div>
            )}
            {myPcReady && (myPc ? (
              <p className="pcs-summary">
                {myPc.gpu.name} / {myPc.cpu.name} / {myPc.ram}GB
                <MyPcLink className="pcs-link">변경</MyPcLink>
              </p>
            ) : (
              <MyPcLink className="pcs-link pcs-filter-btn">내 PC 사양 입력하기</MyPcLink>
            ))}
          </section>
        )}

        {/* 지금 뜨는 게임 — 매일 판정해 저장한 값(games.trend_badge, app/lib/trending)으로 거름. 켜면 기본 정렬이 판정 점수순 */}
        <FoldSection title="지금 뜨는 게임" count={selectedTrend.length}>
          <div className="filter-chips">
            {TRENDS.map(([k, label]) => (
              <button key={k} type="button" className={`chip${selectedTrend.includes(k) ? ' on' : ''}`} aria-pressed={selectedTrend.includes(k)} onClick={() => toggleTrend(k)}>{label}</button>
            ))}
          </div>
        </FoldSection>

        <FoldSection title="같이 하는 방식" count={selectedCategory ? 1 : 0}>
          <div className="filter-chips">
            {CATEGORIES.map(c => (
              <button key={c} type="button" className={`chip${selectedCategory === c ? ' on' : ''}`} aria-pressed={selectedCategory === c}
                {...playHint.bind(c)} onClick={() => setSelectedCategory(selectedCategory === c ? '' : c)}>{c}</button>
            ))}
          </div>
          {playHint.hint}
        </FoldSection>

        {/* 인원 — 친구랑 같이 할 수 있는 인원(팀 인원, 없으면 최대 인원) 기준 (app/lib/rangeFilter) */}
        <section className="filter-section">
          <RangeSlider
            title="인원" value={playersRange} max={PLAYERS_MAX} minHigh={1}
            label={playersLabel} onChange={setPlayersRange}
            lowName="최소 인원" highName="최대 인원"
          />
          <div className="filter-chips">
            <button type="button" className={`chip${soloOnly ? ' on' : ''}`} aria-pressed={soloOnly} {...soloHint.bind('1인 전용')} onClick={() => pickMax('solo')}>1인 전용</button>
            <button type="button" className={`chip${duoOnly ? ' on' : ''}`} aria-pressed={duoOnly} {...soloHint.bind('2인 전용')} onClick={() => pickMax('duo')}>2인 전용</button>
            <button type="button" className={`chip${largeOnly ? ' on' : ''}`} aria-pressed={largeOnly} {...soloHint.bind('8인 이상')} onClick={() => pickMax('large')}>8인 이상</button>
            <button type="button" className={`chip${storyOnly ? ' on' : ''}`} aria-pressed={storyOnly} {...soloHint.bind('혼자도 충분')} onClick={() => setStoryOnly(!storyOnly)}>혼자도 충분</button>
          </div>
          {soloHint.hint}
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
        <FoldSection title="진입장벽" count={selectedBarriers.length}>
          <div className="seg" role="group" aria-label="진입장벽">
            {BARRIERS.map(([ko]) => (
              <button key={ko} type="button" className={`seg-btn${selectedBarriers.includes(ko) ? ' on' : ''}`} aria-pressed={selectedBarriers.includes(ko)}
                {...barrierHint.bind(ko)} onClick={() => toggleBarrier(ko)}>{ko}</button>
            ))}
          </div>
          {barrierHint.hint}
        </FoldSection>

        {/* 네트워크 — 크로스플레이는 따로, 전용 서버·P2P는 고른 것 중 하나 (온라인 협동·대전이 있는 게임만) */}
        <FoldSection title="네트워크" count={selectedNet.length}>
          <ul className="tag-tree">
            {NETS.map(([k, label]) => (
              <li key={k}>
                <div className="tag-row">
                  <label className="tag-check">
                    <input type="checkbox" checked={selectedNet.includes(k)} onChange={() => toggleNet(k)} />
                    <span className="tag-check-name">{k === 'p2p' ? 'P2P (방장 컴퓨터로 연결)' : label}</span>
                  </label>
                </div>
              </li>
            ))}
          </ul>
        </FoldSection>

        {/* 가능한 활동 — 묶음별 칩(app/lib/activities.ts), 고른 활동을 모두 가진 게임. 기본은 확정만, "확인 중 포함"을 켜면 확인 중 활동도 같은 활동으로 봄. 칩 옆 숫자는 그 활동이 있는 게임 수(0이면 흐리게) */}
        <FoldSection title="가능한 활동" count={selectedActs.length}>
          <div className="filter-chips">
            <button type="button" className={`chip${actIncludeUnsure ? ' on' : ''}`} aria-pressed={actIncludeUnsure} onClick={() => setActIncludeUnsure(!actIncludeUnsure)}>확인 중 포함</button>
          </div>
          <p className="filter-note">{actIncludeUnsure ? 'AI가 있을 것으로 판단했지만 공식 설명에서 확인하지 못한 활동도 포함해요' : '설명에서 확인된 활동만 보여줘요'}</p>
          {ACTIVITY_BY_GROUP.map(({ group, items }) => (
            <div key={group} className="act-group">
              <p className="filter-label">{group}</p>
              <div className="filter-chips">
                {items.map((a) => {
                  const n = actCounts.get(a.key) ?? 0;
                  const on = selectedActs.includes(a.key);
                  return (
                    <button key={a.key} type="button" className={`chip${on ? ' on' : ''}${n === 0 ? ' is-zero' : ''}`} aria-pressed={on} disabled={n === 0 && !on} onClick={() => toggleAct(a.key)}>
                      {a.label}<span className="chip-n">{n}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </FoldSection>

        {/* 분류 — 큰 칸을 고르면 그 아래 태그 중 하나라도 있는 게임, 서로 다른 칸끼리는 모두 만족 */}
        <FoldSection title="분류" count={selectedTags.length}>
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
                const kids = shownKids(tree, node.children, tagCounts);
                // 많은 칸은 처음 일부만 — 숨겨진 칸에 고른 게 있으면 처음부터 다 보임
                const foldable = kids.length - MORE_LIMIT >= 2;
                const hiddenPicked = foldable && kids.slice(MORE_LIMIT).some((c) => selectedTags.some((t) => isUnder(tree, Number(t), c)));
                const more = !foldable || hiddenPicked || moreRoots.includes(id);
                return (
                  <div key={id} className="filter-acc-item">
                    <button type="button" className="filter-acc-head" aria-expanded={open} onClick={() => toggleRoot(id)}>
                      <span className="filter-acc-name">{node.ko}</span>
                      {picked > 0 && <span className="badge badge-accent">{picked}개 선택</span>}
                      <span className="filter-acc-state">{open ? '접기' : '펼치기'}</span>
                    </button>
                    {open && (
                      <ul className="tag-tree" role="group">
                        {(more ? kids : kids.slice(0, MORE_LIMIT)).map((c) => (
                          <TagRow key={c} id={c} tree={tree} counts={tagCounts} selected={selectedTags} onToggle={toggleTag} />
                        ))}
                        {foldable && !hiddenPicked && (
                          <li><button type="button" className="filter-more" onClick={() => toggleMore(id)}>{more ? '접기' : `더 보기 (${kids.length - MORE_LIMIT}개)`}</button></li>
                        )}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </FoldSection>

        {/* 빼고 보기 — 이용 연령·표현 */}
        {excludable.length > 0 && (
          <FoldSection title="빼고 보기" count={excludedTags.length}>
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
          </FoldSection>
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

// 분류 트리에 보일 칸들 — 게임이 있는 칸만. 활동과 같은 뜻의 태그(ACTIVITY_TAG_MAP: 운전·낚시 등)는 "가능한 활동"에서만 고르므로 숨기고,
// 그 아래 칸이 있으면(예: 스포츠 아래 팀 구기 종목) 사라지지 않게 그 자리로 올려 보인다
function shownKids(tree: TagTree, ids: number[], counts: Map<number, number>): number[] {
  return ids.filter((c) => counts.get(c)).flatMap((c) => (activityForTag(String(c)) ? shownKids(tree, tree.nodes.get(c)?.children ?? [], counts) : [c]));
}

// 접을 수 있는 필터 섹션 — 기본은 접힘, 제목 줄 전체가 토글. 고른 값이 있으면 처음부터 펼침(직접 접으면 제목 옆에 개수만 남김)
function FoldSection({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  const [userOpen, setUserOpen] = useState<boolean | null>(null);
  const open = userOpen ?? count > 0;
  return (
    <section className="filter-section is-fold">
      <button type="button" className="filter-fold-head" aria-expanded={open} onClick={() => setUserOpen(!open)}>
        <span className="filter-fold-title">{title}</span>
        {count > 0 && <span className="filter-fold-count">{count}개 선택</span>}
        <span className="filter-acc-state">{open ? '접기' : '펼치기'}</span>
      </button>
      {open && <div className="filter-fold-body">{children}</div>}
    </section>
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
  const kids = shownKids(tree, node.children, counts);
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
