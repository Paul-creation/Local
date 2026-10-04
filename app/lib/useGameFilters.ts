// 담당: 친구(검색·태그·비교)
'use client';

import { useState, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { compareBlockReason, MAX_COMPARE, COMPARE_PICK_KEY } from './compareRule';
import { matchesGame, normalizeSearch, searchNames } from './searchMatch';
import { buildTagLookup, hasTag, parseSearchInput, FLAG_TAGS, isTreeTag } from './tagSearch';
import { countByNode, nameToTagId, type TagTree } from './tagTree';
import { getPriceInfo } from './price';
import {
  type Range, PLAYERS_ALL, PRICE_ALL, FREE_ONLY, isAll,
  parsePlayers, legacyPlayers, parsePrice, formatPlayers, formatPrice, matchesPlayers, matchesPrice,
} from './rangeFilter';
import { HOME_FILTER_STYLE_ID } from './homeFilter';
import { BADGES, badgeMatches } from './badge.mjs';

// 검색 결과는 처음 이만큼만 그리고, 더 보기로 이만큼씩 늘린다
export const PAGE_SIZE = 24;


// 진입장벽 칩 ↔ 주소 값 (?barrier=low,mid)
export const BARRIERS = [['낮음', 'low'], ['보통', 'mid'], ['높음', 'high']] as const;
const barrierFromUrl = (v: string | null) => (v || '').split(',').map((x) => BARRIERS.find(([, u]) => u === x)?.[0]).filter(Boolean) as string[];
const barrierToUrl = (list: string[]) => BARRIERS.filter(([ko]) => list.includes(ko)).map(([, u]) => u).join(',');

// games: 첫 화면 뒤에 받아 오는 전체 목록 / tree: 태그 나무 (app/lib/useGameIndex) — 아직 없으면 null
export function useGameFilters(games: any[] | null, tree: TagTree | null = null) {
  // 서버에서 미리 그린 홈 화면과 맞추려고 처음엔 빈 상태로 그리고, 주소(검색 조건)는 그리기 직전에 한 번 읽는다
  // (useSearchParams를 쓰면 정적 페이지 전체가 브라우저 렌더링으로 떨어져서 홈 섹션이 HTML에 안 들어감)
  const [inited, setInited] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  // OP.GG처럼 입력 중인 글자(input)와 엔터로 확정한 검색어(query)를 나눈다. 결과·주소의 q는 query만 따른다.
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  // 고른 태그: 태그 나무 칸 번호("1663") 또는 협동·대전 단어 (app/lib/tagSearch). 서로 다른 칸끼리는 AND
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  // 빼고 보기: 이용 연령·표현 칸(선정성·폭력·고어·유혈) 중 고른 칸의 게임을 뺀다
  const [excludedTags, setExcludedTags] = useState<string[]>([]);
  // 진입장벽 낮음·보통·높음 (여러 개 고르면 그중 하나)
  const [selectedBarriers, setSelectedBarriers] = useState<string[]>([]);
  // 혼자도 꽉 차게 (solo_mode = story)
  const [storyOnly, setStoryOnly] = useState(false);
  // 인원·가격 범위 슬라이더 (눈금 번호, app/lib/rangeFilter) — 양 끝이면 필터 없음
  const [playersRange, setPlayersRange] = useState<Range>(PLAYERS_ALL);
  // 1인 전용(최대 인원 1) — 메인 "혼자" 바로가기용. 슬라이더와 따로 걸린다
  const [soloOnly, setSoloOnly] = useState(false);
  const [priceRange, setPriceRange] = useState<Range>(PRICE_ALL);
  const [saleOnly, setSaleOnly] = useState(false);
  const [compareList, setCompareList] = useState<any[]>([]);
  const [compareError, setCompareError] = useState('');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  // 주소의 비교 선택(cmp)은 목록이 온 뒤에 게임 정보로 바꿔 채운다
  const pendingCmp = useRef<string[]>([]);

  // 주소 → 상태 (화면에 그리기 전에 한 번). 클라이언트 이동으로 돌아온 경우도 같은 자리에서 처리
  useLayoutEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    /* eslint-disable react-hooks/set-state-in-effect -- 바깥(주소)에서 한 번 읽어 오는 초기화라 의도된 setState */
    // players·price·sale로 바로 들어오면(바로가기·공유 링크) 결과 화면부터
    setShowResults(sp.get('r') === '1' || sp.has('players') || sp.has('price') || sp.get('sale') === '1' || sp.has('tags') || sp.has('barrier') || sp.has('ex') || sp.get('story') === '1');
    setInput(sp.get('q') || '');
    setQuery(sp.get('q') || '');
    // 예전 주소의 cat=파티·퍼즐·서바이벌처럼 지금 배지에 없는 값은 무시 (결과가 0개로 보이지 않게)
    const cat = sp.get('cat') || '';
    setSelectedCategory(BADGES.includes(cat) ? cat : '');
    // 칸 번호·협동·대전은 그대로, 예전 주소의 태그 이름(?tags=좀비)은 나무가 도착하면 번호로 바꾼다 (아래 효과)
    setSelectedTags((sp.get('tags') || '').split(',').filter(Boolean));
    setExcludedTags((sp.get('ex') || '').split(',').filter(isTreeTag));
    setSelectedBarriers(barrierFromUrl(sp.get('barrier')));
    setStoryOnly(sp.get('story') === '1');
    // players=2-7 · players=5(5~5) / 예전 인원 칸 주소 p=3-4인도 비슷한 범위로
    setPlayersRange(sp.has('players') ? parsePlayers(sp.get('players')) : legacyPlayers(sp.get('p')));
    // 예전 인원 칸 주소의 1인(p=1인)도 1인 전용
    setSoloOnly(sp.get('solo') === '1' || sp.get('p') === '1인');
    // 예전 난이도 주소(?d=쉬움)는 진입장벽과 기준이 달라서 무시
    // 예전 "무료 게임만" 주소(free=1)는 무료~무료
    setPriceRange(sp.has('price') ? parsePrice(sp.get('price')) : sp.get('free') === '1' ? FREE_ONLY : PRICE_ALL);
    setSaleOnly(sp.get('sale') === '1');
    pendingCmp.current = (sp.get('cmp') || '').split(',').filter(Boolean);
    setInited(true);
    /* eslint-enable react-hooks/set-state-in-effect */
    // 이제 React가 홈/결과를 직접 나눠 그리므로, 첫 HTML용 숨김 스타일은 걷어낸다
    document.getElementById(HOME_FILTER_STYLE_ID)?.remove();
  }, []);

  useEffect(() => {
    if (!games || !pendingCmp.current.length) return;
    const ids = pendingCmp.current;
    pendingCmp.current = [];
    setCompareList(ids.map((id) => games.find((g: any) => g.id === id)).filter(Boolean));
  }, [games]);

  // URL_STATE — 필터·결과·비교 선택을 주소에 담아서, 뒤로가기·목록으로 시 그대로 보이게
  useEffect(() => {
    if (!inited) return; // 주소를 읽기 전에 빈 상태로 덮어쓰지 않게
    const q = new URLSearchParams();
    if (showResults) q.set('r', '1');
    if (query) q.set('q', query);
    if (selectedCategory) q.set('cat', selectedCategory);
    if (selectedTags.length) q.set('tags', selectedTags.join(','));
    if (excludedTags.length) q.set('ex', excludedTags.join(','));
    if (selectedBarriers.length) q.set('barrier', barrierToUrl(selectedBarriers));
    if (storyOnly) q.set('story', '1');
    if (formatPlayers(playersRange)) q.set('players', formatPlayers(playersRange));
    if (soloOnly) q.set('solo', '1');
    if (formatPrice(priceRange)) q.set('price', formatPrice(priceRange));
    if (saleOnly) q.set('sale', '1');
    if (compareList.length) q.set('cmp', compareList.map((g: any) => g.id).join(','));
    const qs = q.toString();
    const url = qs ? `/?${qs}` : '/';
    // 홈 화면(필터 없음)에서는 이전 목록 기억을 지워서, 홈에서 연 게임은 홈으로 돌아가게
    if (!qs) { try { sessionStorage.removeItem('list_url'); } catch {} }
    if (window.location.pathname === '/' && window.location.pathname + window.location.search !== url) {
      window.history.replaceState(null, '', url);
    }
  }, [inited, showResults, query, selectedCategory, selectedTags, excludedTags, selectedBarriers, storyOnly, playersRange, soloOnly, priceRange, saleOnly, compareList]);

  // 카드나 비교하기를 누를 때 지금 목록 주소와 스크롤 위치를 기억
  const rememberList = () => {
    try {
      sessionStorage.setItem('list_url', window.location.pathname + window.location.search);
      sessionStorage.setItem('list_scroll', String(window.scrollY));
      sessionStorage.setItem('list_count', String(visibleCount));
    } catch {}
  };

  // 메인에서 골라둔 비교 게임을 비교 만들기 화면(/compare)에 넘겨주려고 기억 (처음 열 때 빈 목록으로 지우지는 않음)
  const prevPick = useRef<string | null>(null);
  useEffect(() => {
    if (!inited) return;
    const ids = compareList.map((g: any) => g.id).join(',');
    try {
      if (ids) sessionStorage.setItem(COMPARE_PICK_KEY, ids);
      else if (prevPick.current) sessionStorage.removeItem(COMPARE_PICK_KEY);
    } catch {}
    prevPick.current = ids;
  }, [inited, compareList]);

  const toggleCompare = (game: any) => {
    setCompareList(prev => {
      if (prev.find(g => g.id === game.id)) return prev.filter(g => g.id !== game.id);
      if (prev.length >= MAX_COMPARE) return prev;
      const reason = compareBlockReason(prev, game);
      if (reason) {
        setCompareError(reason);
        setTimeout(() => setCompareError(''), 2000);
        return prev;
      }
      return [...prev, game];
    });
  };

  const toggleTag = (tag: string) =>
    setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  const toggleExcluded = (tag: string) =>
    setExcludedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  const toggleBarrier = (b: string) =>
    setSelectedBarriers(prev => prev.includes(b) ? prev.filter(x => x !== b) : [...prev, b]);
  const addTags = (tags: string[]) =>
    setSelectedTags(prev => [...prev, ...tags.filter(t => !prev.includes(t))]);

  // 칸마다 게임 수 (0개인 칸은 아코디언·검색에서 숨김)
  const tagCounts = useMemo(() => (tree && games ? countByNode(tree, games) : new Map<number, number>()), [tree, games]);
  // 검색창 태그 입력용 — 태그 나무 이름·영문·별칭 + 협동·대전 (app/lib/tagSearch)
  const tagLookup = useMemo(() => buildTagLookup(tree, tagCounts), [tree, tagCounts]);

  // 예전 주소의 태그 이름(?tags=좀비,오픈월드)을 나무가 도착하면 칸 번호로 바꾼다. 모르는 이름은 버림 (결과 0개 방지)
  const convertedTags = useRef(false);
  useEffect(() => {
    if (convertedTags.current || !inited || !tree) return;
    convertedTags.current = true;
    const next = selectedTags
      .map((t) => (isTreeTag(t) || FLAG_TAGS[t] ? t : nameToTagId(tree, t) != null ? String(nameToTagId(tree, t)) : null))
      .filter((t, i, arr): t is string => !!t && arr.indexOf(t) === i);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 주소에서 읽은 예전 태그 이름을 나무 도착 후 한 번 바꾸는 것
    if (next.join(',') !== selectedTags.join(',')) setSelectedTags(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 처음 한 번만
  }, [inited, tree]);

  // 입력을 태그와 게임 이름으로 나눈다. 게임 이름과 똑같이 입력했으면(예: "Party Animals") 나누지 않고 이름으로
  const splitInput = (text: string) => {
    const key = normalizeSearch(text);
    if (!key || (games || []).some((g) => searchNames(g).some((n) => normalizeSearch(n) === key))) {
      return { tags: [] as string[], rest: text.trim() };
    }
    return parseSearchInput(text, tagLookup);
  };

  // 예전 주소(?q=좀비)로 들어온 경우에도 목록이 도착하면 태그 단어를 태그 조건으로 옮긴다
  const convertedQuery = useRef(false);
  useEffect(() => {
    if (convertedQuery.current || !inited || !games) return;
    convertedQuery.current = true;
    const { tags, rest } = splitInput(query);
    if (!tags.length) return;
    /* eslint-disable react-hooks/set-state-in-effect -- 주소에서 읽은 검색어를 목록 도착 후 한 번 나누는 것 */
    addTags(tags);
    setInput(rest);
    setQuery(rest);
    /* eslint-enable react-hooks/set-state-in-effect */
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 처음 한 번만
  }, [inited, games]);

  const normalizedQuery = query.trim().toLowerCase();
  const playersOn = !isAll(playersRange, PLAYERS_ALL);
  const priceOn = !isAll(priceRange, PRICE_ALL);
  const selectedCount = [selectedCategory, playersOn ? '인원' : '', soloOnly ? '1인 전용' : '', storyOnly ? '혼자도' : '', priceOn ? '가격' : '', saleOnly ? '할인' : '', ...selectedBarriers, ...selectedTags, ...excludedTags].filter(Boolean).length;
  const hasFilters = !!(normalizedQuery || selectedCategory || selectedTags.length > 0 || excludedTags.length > 0 || selectedBarriers.length > 0 || storyOnly || playersOn || soloOnly || priceOn || saleOnly);

  const filtered = (games || []).filter((g) => {
    // 지금 실제 가격(할인 중이면 할인가) 기준
    if (!matchesPrice(g, priceRange)) return false;
    if (saleOnly && !((getPriceInfo(g)?.discount ?? 0) > 0)) return false;
    if (selectedCategory && !badgeMatches(g.category, selectedCategory)) return false;
    // 고른 칸을 전부 만족하는 게임만 (AND). 상위 칸은 그 아래 태그 중 하나라도 있으면,
    // 협동·대전은 스팀 카테고리 플래그(has_online_coop 등)로 (app/lib/tagSearch)
    if (selectedTags.length > 0 && !selectedTags.every(t => hasTag(g, t, tree))) return false;
    // 빼고 보기: 고른 칸(선정성·폭력·고어·유혈) 중 하나라도 있으면 뺀다
    if (excludedTags.length > 0 && excludedTags.some(t => hasTag(g, t, tree))) return false;
    if (selectedBarriers.length > 0 && !selectedBarriers.includes(g.entry_barrier)) return false;
    if (storyOnly && g.solo_mode !== 'story') return false;
    if (!matchesPlayers(g, playersRange)) return false;
    if (soloOnly && g.max_players !== 1) return false;
    // 영어 이름·한국어 이름·별명 (띄어쓰기·대소문자·기호 무시). 태그 단어는 확정할 때 태그 조건으로 옮겨 둠
    if (normalizedQuery) return matchesGame(g, normalizedQuery);
    return true;
  });

  // 검색어·필터가 바뀌면 다시 처음 24개부터 (처음 열 때는 그대로)
  const filterKey = [query, selectedCategory, selectedTags.join(','), excludedTags.join(','), selectedBarriers.join(','), storyOnly, playersRange.join('-'), soloOnly, priceRange.join('-'), saleOnly].join('|');
  const prevFilterKey = useRef<string | null>(null);
  useEffect(() => {
    if (prevFilterKey.current !== null && prevFilterKey.current !== filterKey) setVisibleCount(PAGE_SIZE);
    prevFilterKey.current = filterKey;
  }, [filterKey]);
  const showMore = () => setVisibleCount((n) => n + PAGE_SIZE);

  // 돌아왔을 때 보던 스크롤 위치로 — 목록이 도착해 결과를 그릴 수 있을 때 한 번
  // (검색어·필터가 바뀌어 24개로 되돌리는 위 효과보다 뒤에 둬야 늘려둔 개수가 남는다)
  const restored = useRef(false);
  useEffect(() => {
    if (restored.current || !inited || !games) return;
    restored.current = true;
    try {
      const y = Number(sessionStorage.getItem('list_scroll') || 0);
      const count = Number(sessionStorage.getItem('list_count') || 0);
      sessionStorage.removeItem('list_scroll');
      sessionStorage.removeItem('list_count');
      // 더 보기로 늘려둔 개수까지 먼저 그린 다음 스크롤
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 저장해 둔 개수를 한 번 되살리는 것
      if (count > PAGE_SIZE && showResults) setVisibleCount(count);
      if (y > 0 && showResults) setTimeout(() => window.scrollTo(0, y), 80);
    } catch {}
  }, [inited, games, showResults]);

  // 엔터(또는 결과 보기)로 지금 입력한 글자를 검색어로 확정하고 결과 화면 맨 위로
  // 태그로 알아본 단어는 태그 조건(칩)으로 옮기고, 나머지만 이름 검색어로 남긴다
  const submitSearch = () => {
    const { tags, rest } = splitInput(input);
    if (tags.length) addTags(tags);
    setInput(rest);
    setQuery(rest);
    setShowResults(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // 필터 조건만 지우기 (검색어·비교 선택·결과 화면은 그대로) — 필터 패널의 "전체 지우기"
  const clearConditions = () => {
    setSelectedCategory('');
    setSelectedTags([]);
    setExcludedTags([]);
    setSelectedBarriers([]);
    setStoryOnly(false);
    setPlayersRange(PLAYERS_ALL);
    setSoloOnly(false);
    setPriceRange(PRICE_ALL);
    setSaleOnly(false);
  };

  const resetFilters = () => {
    setInput('');
    setQuery('');
    setSelectedCategory('');
    setSelectedTags([]);
    setExcludedTags([]);
    setSelectedBarriers([]);
    setStoryOnly(false);
    setPlayersRange(PLAYERS_ALL);
    setSoloOnly(false);
    setPriceRange(PRICE_ALL);
    setSaleOnly(false);
    setShowResults(false);
    setFilterOpen(false);
    setCompareList([]);
  };

  return {
    loaded: !!games,
    showResults, setShowResults,
    filterOpen, setFilterOpen,
    input, setInput,
    query, submitSearch,
    selectedCategory, setSelectedCategory,
    selectedTags, toggleTag, addTags, tagLookup, splitInput, tagCounts, tree,
    excludedTags, toggleExcluded,
    selectedBarriers, toggleBarrier,
    storyOnly, setStoryOnly,
    playersRange, setPlayersRange,
    soloOnly, setSoloOnly,
    priceRange, setPriceRange,
    saleOnly, setSaleOnly,
    compareList, setCompareList, compareError, toggleCompare,
    rememberList,
    normalizedQuery, selectedCount, hasFilters,
    filtered, visibleCount, showMore,
    resetFilters, clearConditions,
  };
}

export type GameFilters = ReturnType<typeof useGameFilters>;
