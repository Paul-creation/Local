// 담당: 친구(검색·태그·비교)
'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import type { GameFilters } from '../../lib/useGameFilters';
import { matchRank } from '../../lib/searchMatch';
import { playersText } from '../../lib/players';
import { splitWords, suggestTags, tagKeyLabel } from '../../lib/tagSearch';
import { suggestActivities } from '../../lib/activitySearch';
import { activityForTag, activityLabel, type ActivityKey } from '../../lib/activities';
import GameImage from '../GameImage';

const MAX_SUGGESTIONS = 6;
const MAX_TAG_SUGGESTIONS = 4;
const MAX_ACT_SUGGESTIONS = 2;

const playersLabel = (g: any) => playersText(g);

// 검색창 + 자동완성. 입력 중에는 결과 화면으로 넘어가지 않고, 맞는 태그·게임만 아래에 보여준다.
// 태그 단어(예: "좀비, 협동")는 엔터나 후보 선택으로 태그 조건이 되어 검색창 아래 칩으로 보인다 (app/lib/tagSearch)
export default function SearchBox({ games, filters, trailing }: { games: any[], filters: GameFilters, trailing?: ReactNode }) {
  const { input, setInput, submitSearch, rememberList, selectedTags, toggleTag, addTags, selectedActs, toggleAct, tagLookup, splitInput, tree } = filters;
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const boxRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  const q = input.trim();
  // 이름(영어·한국어·별명 중 하나)이 검색어로 시작하는 게임을 먼저, 그다음 이름에 포함된 게임
  const matchNames = (text: string) =>
    games
      .map((g) => ({ g, rank: matchRank(g, text) }))
      .filter((x) => x.rank >= 0)
      .sort((a, b) => a.rank - b.rank)
      .slice(0, MAX_SUGGESTIONS)
      .map((x) => x.g);
  // 입력 전체가 이름과 안 맞으면 태그 단어를 뺀 나머지로 ("엘든링 협동" → 엘든링)
  let gameSuggestions = q ? matchNames(q) : [];
  if (q && !gameSuggestions.length) {
    const rest = splitInput(q).rest;
    if (rest && rest !== q) gameSuggestions = matchNames(rest);
  }
  // 지금 입력 중인 마지막 단어로 태그 후보 (쉼표·띄어쓰기를 막 친 뒤에는 안 보여줌)
  const words = splitWords(input);
  const lastWord = /[,\s]$/.test(input) ? '' : words[words.length - 1] || '';
  const tagMatches = suggestTags(lastWord, tagLookup, selectedTags, MAX_TAG_SUGGESTIONS);
  // 활동 라벨("운전"·"낚시")을 치면 그 활동 필터를 후보로 — 고르면 "가능한 활동" 조건이 걸린다 (app/lib/activitySearch)
  // 활동과 같은 뜻의 태그(운전↔Driving 등)는 활동 한 줄로 합친다. 이미 적용된 활동·같은 뜻의 태그는 다시 제안하지 않는다
  const selectedTagActs = selectedTags.map(activityForTag).filter((a): a is ActivityKey => !!a);
  const taken = [...selectedActs, ...selectedTagActs];
  const tagSuggestions = tagMatches.filter((t) => !activityForTag(t));
  const actSuggestions = [...new Set([
    ...suggestActivities(lastWord, taken, MAX_ACT_SUGGESTIONS),
    ...tagMatches.map(activityForTag).filter((a): a is ActivityKey => !!a && !taken.includes(a)),
  ])];
  const suggestions = [
    ...tagSuggestions.map((tag) => ({ kind: 'tag' as const, tag })),
    ...actSuggestions.map((act) => ({ kind: 'act' as const, act })),
    ...gameSuggestions.map((g) => ({ kind: 'game' as const, g })),
  ];
  const showList = open && suggestions.length > 0;

  // 바깥을 누르면 닫기
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
    };
  }, [open]);

  // 태그 후보를 고르면 입력 중이던 마지막 단어를 지우고 태그 칩으로
  const pickTag = (tag: string) => {
    addTags([tag]);
    const kept = words.slice(0, lastWord ? -1 : undefined).join(' ');
    setInput(kept ? `${kept} ` : '');
    setActive(-1);
    inputRef.current?.focus();
  };

  const pickAct = (key: string) => {
    toggleAct(key);
    const kept = words.slice(0, lastWord ? -1 : undefined).join(' ');
    setInput(kept ? `${kept} ` : '');
    setActive(-1);
    inputRef.current?.focus();
  };

  const goToGame = (game: any) => {
    setOpen(false);
    rememberList();
    router.push(`/games/${game.id}`);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // 한글 조합 중 엔터·화살표는 무시 (조합 끝날 때 한 번 더 들어와서 두 번 실행되는 것 방지)
    if (e.nativeEvent.isComposing) return;
    // 빈 입력에서 지우기 키 → 마지막 태그 칩 지우기
    if (e.key === 'Backspace' && !input && (selectedActs.length > 0 || selectedTags.length > 0)) {
      if (selectedActs.length > 0) toggleAct(selectedActs[selectedActs.length - 1]);
      else toggleTag(selectedTags[selectedTags.length - 1]);
      return;
    }
    if (e.key === 'ArrowDown' && suggestions.length > 0) {
      e.preventDefault();
      setOpen(true);
      setActive((i) => (i + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp' && suggestions.length > 0) {
      e.preventDefault();
      setOpen(true);
      setActive((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === 'Escape') {
      setOpen(false);
      setActive(-1);
    } else if (e.key === 'Enter') {
      const picked = showList && active >= 0 ? suggestions[active] : null;
      if (picked?.kind === 'tag') {
        pickTag(picked.tag);
      } else if (picked?.kind === 'act') {
        pickAct(picked.act);
      } else if (picked?.kind === 'game') {
        goToGame(picked.g);
      } else {
        setOpen(false);
        setActive(-1);
        submitSearch();
      }
    }
  };

  return (
    <div className="search-box" ref={boxRef}>
      <div className="search-box-field">
      <div className={`search-bar-clean${selectedTags.length || selectedActs.length ? ' has-chips' : ''}`}>
        {/* 검색창 안 태그 칩 — 입력으로 알아본 것과 필터에서 고른 것 모두. ×로 지움 */}
        {selectedTags.map((tag) => (
          <button key={tag} type="button" className="search-tag-chip" onClick={() => toggleTag(tag)} aria-label={`${tagKeyLabel(tag, tree)} 태그 지우기`}>
            {tagKeyLabel(tag, tree)} <span aria-hidden="true">×</span>
          </button>
        ))}
        {/* 활동 조건도 태그처럼 "운전 ×" 칩으로 */}
        {selectedActs.map((act) => (
          <button key={act} type="button" className="search-tag-chip" onClick={() => toggleAct(act)} aria-label={`${activityLabel(act)} 활동 지우기`}>
            {activityLabel(act)} <span aria-hidden="true">×</span>
          </button>
        ))}
        <input
          ref={inputRef}
          type="text"
          placeholder={selectedTags.length || selectedActs.length ? '검색어 더하기' : '게임 이름이나 태그로 검색'}
          value={input}
          onChange={(e) => { setInput(e.target.value); setOpen(true); setActive(-1); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          role="combobox"
          aria-expanded={showList}
          aria-controls="search-suggest"
          aria-autocomplete="list"
          aria-activedescendant={showList && active >= 0 ? `search-suggest-${active}` : undefined}
        />
        {input && <button type="button" className="search-clear" aria-label="입력 지우기" onClick={() => { setInput(''); setActive(-1); }}>×</button>}
        {/* 검색창 안쪽 오른쪽 — 필터 버튼 (SearchPanel) */}
        {trailing}
      </div>

      {showList && (
        <ul className="search-suggest" id="search-suggest" role="listbox">
          {suggestions.map((s, i) => s.kind === 'act' ? (
            <li key={`act-${s.act}`} role="option" id={`search-suggest-${i}`} aria-selected={i === active}>
              <button
                type="button"
                className={`search-suggest-item search-suggest-tag${i === active ? ' is-active' : ''}`}
                onClick={() => pickAct(s.act)}
                onMouseEnter={() => setActive(i)}
              >
                <span className="search-suggest-tag-mark">활동</span>
                <span className="search-suggest-name">{activityLabel(s.act)}</span>
              </button>
            </li>
          ) : s.kind === 'tag' ? (
            <li key={`tag-${s.tag}`} role="option" id={`search-suggest-${i}`} aria-selected={i === active}>
              <button
                type="button"
                className={`search-suggest-item search-suggest-tag${i === active ? ' is-active' : ''}`}
                onClick={() => pickTag(s.tag)}
                onMouseEnter={() => setActive(i)}
              >
                <span className="search-suggest-tag-mark">태그</span>
                <span className="search-suggest-name">{tagKeyLabel(s.tag, tree)}</span>
              </button>
            </li>
          ) : (
            <li key={s.g.id} role="option" id={`search-suggest-${i}`} aria-selected={i === active}>
              <Link
                href={`/games/${s.g.id}`}
                className={`search-suggest-item${i === active ? ' is-active' : ''}`}
                onClick={() => { setOpen(false); rememberList(); }}
                onMouseEnter={() => setActive(i)}
              >
                {s.g.cover_image_url ? <GameImage src={s.g.cover_image_url} steamSize="header_292x136" /> : <span className="search-suggest-noimg" />}
                <span className="search-suggest-name">{s.g.name}</span>
                <span className="search-suggest-players">{playersLabel(s.g)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      </div>

    </div>
  );
}
