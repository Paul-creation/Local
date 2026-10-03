// 담당: 친구(검색·태그·비교)
'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { GameFilters } from '../../lib/useGameFilters';
import { matchRank } from '../../lib/searchMatch';

const MAX_SUGGESTIONS = 6;

function playersLabel(g: any) {
  if (!g.min_players || !g.max_players) return '';
  return g.min_players === g.max_players ? `${g.min_players}인` : `${g.min_players}-${g.max_players}인`;
}

// 검색창 + 자동완성. 입력 중에는 결과 화면으로 넘어가지 않고, 이름이 맞는 게임만 아래에 보여준다.
export default function SearchBox({ games, filters }: { games: any[], filters: GameFilters }) {
  const { input, setInput, submitSearch, rememberList } = filters;
  const router = useRouter();
  const boxRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  const q = input.trim();
  // 이름(영어·한국어·별명 중 하나)이 검색어로 시작하는 게임을 먼저, 그다음 이름에 포함된 게임
  const suggestions = q
    ? games
        .map((g) => ({ g, rank: matchRank(g, q) }))
        .filter((x) => x.rank >= 0)
        .sort((a, b) => a.rank - b.rank)
        .slice(0, MAX_SUGGESTIONS)
        .map((x) => x.g)
    : [];
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

  const goToGame = (game: any) => {
    setOpen(false);
    rememberList();
    router.push(`/games/${game.id}`);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // 한글 조합 중 엔터·화살표는 무시 (조합 끝날 때 한 번 더 들어와서 두 번 실행되는 것 방지)
    if (e.nativeEvent.isComposing) return;
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
      if (showList && active >= 0 && suggestions[active]) {
        goToGame(suggestions[active]);
      } else {
        setOpen(false);
        setActive(-1);
        submitSearch();
      }
    }
  };

  return (
    <div className="search-box" ref={boxRef}>
      <div className="search-bar-clean">
        <input
          type="text"
          placeholder="게임 이름으로 검색..."
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
        {input && <button className="search-clear" aria-label="입력 지우기" onClick={() => { setInput(''); setActive(-1); }}>✕</button>}
      </div>

      {showList && (
        <ul className="search-suggest" id="search-suggest" role="listbox">
          {suggestions.map((g, i) => (
            <li key={g.id} role="option" id={`search-suggest-${i}`} aria-selected={i === active}>
              <Link
                href={`/games/${g.id}`}
                className={`search-suggest-item${i === active ? ' is-active' : ''}`}
                onClick={() => { setOpen(false); rememberList(); }}
                onMouseEnter={() => setActive(i)}
              >
                {g.cover_image_url ? <img src={g.cover_image_url} alt="" /> : <span className="search-suggest-noimg" />}
                <span className="search-suggest-name">{g.name}</span>
                <span className="search-suggest-players">{playersLabel(g)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
