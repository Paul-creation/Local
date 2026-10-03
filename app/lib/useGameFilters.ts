// 담당: 친구(검색·태그·비교)
'use client';

import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { compareBlockReason, MAX_COMPARE, COMPARE_PICK_KEY } from './compareRule';
import { matchesGame, normalizeSearch } from './searchMatch';
import { LARGE_LOBBY } from './players';

// 검색 결과는 처음 이만큼만 그리고, 더 보기로 이만큼씩 늘린다
export const PAGE_SIZE = 24;

export function useGameFilters(games: any[]) {
  const sp = useSearchParams();
  const [showResults, setShowResults] = useState(sp.get('r') === '1');
  const [filterOpen, setFilterOpen] = useState(false);
  // OP.GG처럼 입력 중인 글자(input)와 엔터로 확정한 검색어(query)를 나눈다. 결과·주소의 q는 query만 따른다.
  const [input, setInput] = useState(sp.get('q') || '');
  const [query, setQuery] = useState(sp.get('q') || '');
  const [selectedCategory, setSelectedCategory] = useState(sp.get('cat') || '');
  const [selectedTags, setSelectedTags] = useState<string[]>((sp.get('tags') || '').split(',').filter(Boolean));
  const [selectedPlayers, setSelectedPlayers] = useState(sp.get('p') || '');
  const [selectedDifficulty, setSelectedDifficulty] = useState(sp.get('d') || '');
  const [freeOnly, setFreeOnly] = useState(sp.get('free') === '1');
  const [compareList, setCompareList] = useState<any[]>(() => {
    const ids = (sp.get('cmp') || '').split(',').filter(Boolean);
    return games.filter((g: any) => ids.includes(g.id));
  });
  const [compareError, setCompareError] = useState('');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // URL_STATE — 필터·결과·비교 선택을 주소에 담아서, 뒤로가기·목록으로 시 그대로 보이게
  useEffect(() => {
    const q = new URLSearchParams();
    if (showResults) q.set('r', '1');
    if (query) q.set('q', query);
    if (selectedCategory) q.set('cat', selectedCategory);
    if (selectedTags.length) q.set('tags', selectedTags.join(','));
    if (selectedPlayers) q.set('p', selectedPlayers);
    if (selectedDifficulty) q.set('d', selectedDifficulty);
    if (freeOnly) q.set('free', '1');
    if (compareList.length) q.set('cmp', compareList.map((g: any) => g.id).join(','));
    const qs = q.toString();
    const url = qs ? `/?${qs}` : '/';
    // 홈 화면(필터 없음)에서는 이전 목록 기억을 지워서, 홈에서 연 게임은 홈으로 돌아가게
    if (!qs) { try { sessionStorage.removeItem('list_url'); } catch {} }
    if (window.location.pathname === '/' && window.location.pathname + window.location.search !== url) {
      window.history.replaceState(null, '', url);
    }
  }, [showResults, query, selectedCategory, selectedTags, selectedPlayers, selectedDifficulty, freeOnly, compareList]);

  // 돌아왔을 때 보던 스크롤 위치로
  useEffect(() => {
    try {
      const y = Number(sessionStorage.getItem('list_scroll') || 0);
      const count = Number(sessionStorage.getItem('list_count') || 0);
      sessionStorage.removeItem('list_scroll');
      sessionStorage.removeItem('list_count');
      // 더 보기로 늘려둔 개수까지 먼저 그린 다음 스크롤
      if (count > PAGE_SIZE && showResults) setVisibleCount(count);
      if (y > 0 && showResults) setTimeout(() => window.scrollTo(0, y), 80);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    const ids = compareList.map((g: any) => g.id).join(',');
    try {
      if (ids) sessionStorage.setItem(COMPARE_PICK_KEY, ids);
      else if (prevPick.current) sessionStorage.removeItem(COMPARE_PICK_KEY);
    } catch {}
    prevPick.current = ids;
  }, [compareList]);

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
      if (selectedPlayers === '16명 이상' && !(g.max_players >= LARGE_LOBBY)) return false;
    }
    if (normalizedQuery) {
      // 영어 이름·한국어 이름·별명 (띄어쓰기·대소문자·기호 무시) 또는 태그
      const tagQuery = normalizeSearch(normalizedQuery);
      return matchesGame(g, normalizedQuery) ||
        (!!tagQuery && g.tags?.some((t: string) => normalizeSearch(t).includes(tagQuery)));
    }
    return true;
  });

  // 검색어·필터가 바뀌면 다시 처음 24개부터 (처음 열 때는 그대로)
  const filterKey = [query, selectedCategory, selectedTags.join(','), selectedPlayers, selectedDifficulty, freeOnly].join('|');
  const prevFilterKey = useRef<string | null>(null);
  useEffect(() => {
    if (prevFilterKey.current !== null && prevFilterKey.current !== filterKey) setVisibleCount(PAGE_SIZE);
    prevFilterKey.current = filterKey;
  }, [filterKey]);
  const showMore = () => setVisibleCount((n) => n + PAGE_SIZE);

  // 엔터(또는 결과 보기)로 지금 입력한 글자를 검색어로 확정하고 결과 화면 맨 위로
  const submitSearch = () => {
    setQuery(input);
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
    setShowResults(false);
    setFilterOpen(false);
    setCompareList([]);
  };

  return {
    showResults, setShowResults,
    filterOpen, setFilterOpen,
    input, setInput,
    query, submitSearch,
    selectedCategory, setSelectedCategory,
    selectedTags, toggleTag,
    selectedPlayers, setSelectedPlayers,
    selectedDifficulty, setSelectedDifficulty,
    freeOnly, setFreeOnly,
    compareList, setCompareList, compareError, toggleCompare,
    rememberList,
    normalizedQuery, selectedCount, hasFilters,
    filtered, visibleCount, showMore,
    resetFilters,
  };
}

export type GameFilters = ReturnType<typeof useGameFilters>;
