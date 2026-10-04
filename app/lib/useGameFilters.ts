// 담당: 친구(검색·태그·비교)
'use client';

import { useState, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { compareBlockReason, MAX_COMPARE, COMPARE_PICK_KEY } from './compareRule';
import { matchesGame, normalizeSearch, searchNames } from './searchMatch';
import { buildTagLookup, parseSearchInput } from './tagSearch';
import { LARGE_LOBBY, playersBucket } from './players';
import { getPriceInfo } from './price';
import { HOME_FILTER_STYLE_ID } from './homeFilter';
import { BADGES, badgeMatches } from './badge.mjs';

// 검색 결과는 처음 이만큼만 그리고, 더 보기로 이만큼씩 늘린다
export const PAGE_SIZE = 24;


// games: 첫 화면 뒤에 받아 오는 전체 목록 (app/lib/useGameIndex) — 아직 없으면 null
export function useGameFilters(games: any[] | null) {
  // 서버에서 미리 그린 홈 화면과 맞추려고 처음엔 빈 상태로 그리고, 주소(검색 조건)는 그리기 직전에 한 번 읽는다
  // (useSearchParams를 쓰면 정적 페이지 전체가 브라우저 렌더링으로 떨어져서 홈 섹션이 HTML에 안 들어감)
  const [inited, setInited] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  // OP.GG처럼 입력 중인 글자(input)와 엔터로 확정한 검색어(query)를 나눈다. 결과·주소의 q는 query만 따른다.
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedPlayers, setSelectedPlayers] = useState('');
  const [selectedDifficulty, setSelectedDifficulty] = useState('');
  const [freeOnly, setFreeOnly] = useState(false);
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
    // players·sale로 바로 들어오면(바로가기·공유 링크) 결과 화면부터
    setShowResults(sp.get('r') === '1' || sp.has('players') || sp.get('sale') === '1');
    setInput(sp.get('q') || '');
    setQuery(sp.get('q') || '');
    // 예전 주소의 cat=파티·퍼즐·서바이벌처럼 지금 배지에 없는 값은 무시 (결과가 0개로 보이지 않게)
    const cat = sp.get('cat') || '';
    setSelectedCategory(BADGES.includes(cat) ? cat : '');
    setSelectedTags((sp.get('tags') || '').split(',').filter(Boolean));
    setSelectedPlayers(sp.get('p') || playersBucket(Number(sp.get('players'))));
    setSelectedDifficulty(sp.get('d') || '');
    setFreeOnly(sp.get('free') === '1');
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
    if (selectedPlayers) q.set('p', selectedPlayers);
    if (selectedDifficulty) q.set('d', selectedDifficulty);
    if (freeOnly) q.set('free', '1');
    if (saleOnly) q.set('sale', '1');
    if (compareList.length) q.set('cmp', compareList.map((g: any) => g.id).join(','));
    const qs = q.toString();
    const url = qs ? `/?${qs}` : '/';
    // 홈 화면(필터 없음)에서는 이전 목록 기억을 지워서, 홈에서 연 게임은 홈으로 돌아가게
    if (!qs) { try { sessionStorage.removeItem('list_url'); } catch {} }
    if (window.location.pathname === '/' && window.location.pathname + window.location.search !== url) {
      window.history.replaceState(null, '', url);
    }
  }, [inited, showResults, query, selectedCategory, selectedTags, selectedPlayers, selectedDifficulty, freeOnly, saleOnly, compareList]);

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
  const addTags = (tags: string[]) =>
    setSelectedTags(prev => [...prev, ...tags.filter(t => !prev.includes(t))]);

  // 검색창 태그 입력용 — 게임들에 실제로 붙은 태그 + 영문·별칭 (app/lib/tagSearch)
  const tagLookup = useMemo(() => buildTagLookup((games || []).flatMap((g) => g.tags || [])), [games]);

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
  const selectedCount = [selectedCategory, selectedPlayers, selectedDifficulty, freeOnly ? '무료' : '', saleOnly ? '할인' : '', ...selectedTags].filter(Boolean).length;
  const hasFilters = !!(normalizedQuery || selectedCategory || selectedTags.length > 0 || selectedPlayers || selectedDifficulty || freeOnly || saleOnly);

  const filtered = (games || []).filter((g) => {
    if (freeOnly && !g.is_free) return false;
    if (saleOnly && !((getPriceInfo(g)?.discount ?? 0) > 0)) return false;
    if (selectedCategory && !badgeMatches(g.category, selectedCategory)) return false;
    // 고른 태그를 전부 가진 게임만 (AND)
    if (selectedTags.length > 0 && !selectedTags.every(t => g.tags?.includes(t))) return false;
    if (selectedDifficulty && g.difficulty !== selectedDifficulty) return false;
    if (selectedPlayers) {
      if (selectedPlayers === '1인' && !(g.min_players === 1 && g.max_players === 1)) return false;
      if (selectedPlayers === '2인' && !(g.min_players <= 2 && g.max_players >= 2)) return false;
      if (selectedPlayers === '3-4인' && !(g.max_players >= 3)) return false;
      if (selectedPlayers === '5인 이상' && !(g.max_players >= 5)) return false;
      if (selectedPlayers === '16명 이상' && !(g.max_players >= LARGE_LOBBY)) return false;
    }
    // 영어 이름·한국어 이름·별명 (띄어쓰기·대소문자·기호 무시). 태그 단어는 확정할 때 태그 조건으로 옮겨 둠
    if (normalizedQuery) return matchesGame(g, normalizedQuery);
    return true;
  });

  // 검색어·필터가 바뀌면 다시 처음 24개부터 (처음 열 때는 그대로)
  const filterKey = [query, selectedCategory, selectedTags.join(','), selectedPlayers, selectedDifficulty, freeOnly, saleOnly].join('|');
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

  const resetFilters = () => {
    setInput('');
    setQuery('');
    setSelectedCategory('');
    setSelectedTags([]);
    setSelectedPlayers('');
    setSelectedDifficulty('');
    setFreeOnly(false);
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
    selectedTags, toggleTag, addTags, tagLookup, splitInput,
    selectedPlayers, setSelectedPlayers,
    selectedDifficulty, setSelectedDifficulty,
    freeOnly, setFreeOnly,
    saleOnly, setSaleOnly,
    compareList, setCompareList, compareError, toggleCompare,
    rememberList,
    normalizedQuery, selectedCount, hasFilters,
    filtered, visibleCount, showMore,
    resetFilters,
  };
}

export type GameFilters = ReturnType<typeof useGameFilters>;
