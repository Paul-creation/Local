// 담당: 친구(검색·태그·비교)
'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabase';
import { compareBlockReason, MAX_COMPARE, BUILDER_FIELDS } from '../lib/compareRule';
import { readPick, writePick, COMPARE_EVENT } from '../lib/compareStore';
import { matchRank, looseIlikePattern } from '../lib/searchMatch';
import { playersText } from '../lib/players';
import GameImage from './GameImage';
import { selectGames } from '../lib/visibleGames';

const MAX_SUGGESTIONS = 6;
const QUICK_COUNT = 6;

type Pick = { id: string; name: string; search_name_ko?: string | null; card_image_url?: string | null; cover_image_url?: string | null; min_players?: number | null; max_players?: number | null };

const playersLabel = (g: Pick) => playersText(g);

const savePicks = (picks: Pick[]) =>
  writePick(picks.map((g) => g.id), { source: 'builder', meta: picks.map((g) => ({ id: g.id, name: g.name, thumb: g.cover_image_url || g.card_image_url })) });

// ids를 받은 순서대로 정렬
function inOrder(ids: string[], rows: Pick[]) {
  return ids.map((id) => rows.find((g) => g.id === id)).filter(Boolean) as Pick[];
}

// 비교 만들기 — 칸 3개 + 이름 검색(자동완성) + 인기 게임 빠른 추가
export default function CompareBuilder({ initial, popular }: { initial: Pick[]; popular: Pick[] }) {
  const router = useRouter();
  const [picks, setPicks] = useState<Pick[]>(initial);
  const [error, setError] = useState('');
  const [input, setInput] = useState('');
  const [results, setResults] = useState<Pick[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [searching, setSearching] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const loaded = useRef(initial.length > 0);

  // 주소로 받은 게임이 없으면, 비교함(메인 + 비교·상세 비교에 담기)에 담아 둔 게임을 칸에 미리 채움
  // ready: 비교함을 다 읽은 뒤부터 칸 변경을 비교함에 저장 (읽기 전에 빈 칸으로 덮어쓰지 않게)
  const ready = useRef(false);
  useEffect(() => {
    // 주소로 게임을 받았으면(loaded가 처음부터 true) 그 칸을 비교함에 그대로 저장
    if (loaded.current) { ready.current = true; savePicks(picks); return; }
    loaded.current = true;
    const ids = readPick();
    if (!ids.length) { ready.current = true; return; }
    selectGames(BUILDER_FIELDS).in('id', ids).then(({ data }) => {
      ready.current = true;
      if (data?.length) setPicks((prev) => (prev.length ? prev : inOrder(ids, data)));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 처음 한 번만
  }, []);

  // 고른 게임을 비교함에 저장해서, 다시 들어와도·다른 페이지에서도 그대로 (헤더 숫자·알약도 같이 바뀜)
  useEffect(() => {
    if (ready.current) savePicks(picks);
  }, [picks]);

  // 다른 곳(알약의 × 빼기 등)에서 비교함이 바뀌면 칸도 맞춘다
  useEffect(() => {
    const on = (e: Event) => {
      const d = (e as CustomEvent<{ ids: string[]; source: string }>).detail;
      if (d.source === 'builder') return;
      setPicks((prev) => prev.filter((g) => d.ids.includes(g.id)));
    };
    window.addEventListener(COMPARE_EVENT, on);
    return () => window.removeEventListener(COMPARE_EVENT, on);
  }, []);

  // 입력이 잠깐 멈추면 이름으로 검색 (매 글자마다 요청하지 않게)
  const q = input.trim();
  useEffect(() => {
    if (!q) { setResults([]); setSearching(false); return; }
    let cancelled = false;
    setSearching(true);
    const t = setTimeout(async () => {
      // 영어 이름·한국어 이름 둘 다 느슨하게 넉넉히 받아온 뒤, 공통 규칙(searchMatch)으로 다시 거르고 정렬
      const pattern = looseIlikePattern(q);
      if (!pattern) { if (!cancelled) { setResults([]); setSearching(false); } return; }
      const { data } = await selectGames(BUILDER_FIELDS)
        .or(`name.ilike.${pattern},search_name_ko.ilike.${pattern}`)
        .order('heat_rank', { ascending: true, nullsFirst: false })
        .limit(40);
      const ranked = (data || [])
        .map((g) => ({ g, rank: matchRank(g, q) }))
        .filter((x) => x.rank >= 0)
        .sort((a, b) => a.rank - b.rank) // 같은 순위끼리는 인기순 유지
        .slice(0, MAX_SUGGESTIONS)
        .map((x) => x.g);
      if (!cancelled) { setResults(ranked); setActive(-1); setSearching(false); }
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [q]);

  // 바깥을 누르면 목록 닫기
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

  const add = (game: Pick) => {
    const reason = compareBlockReason(picks, game);
    if (reason) { setError(reason); setOpen(false); return; } // 목록을 닫아야 문구가 보임
    setError('');
    setPicks([...picks, game]);
    setInput('');
    setResults([]);
    setOpen(false);
  };

  const remove = (id: string) => {
    setError('');
    setPicks(picks.filter((g) => g.id !== id));
  };

  const showList = open && !!q && results.length > 0;

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // 한글 조합 중 엔터·화살표는 무시 (조합 끝날 때 한 번 더 들어와서 두 번 실행되는 것 방지)
    if (e.nativeEvent.isComposing) return;
    if (e.key === 'ArrowDown' && results.length > 0) {
      e.preventDefault();
      setOpen(true);
      setActive((i) => (i + 1) % results.length);
    } else if (e.key === 'ArrowUp' && results.length > 0) {
      e.preventDefault();
      setOpen(true);
      setActive((i) => (i <= 0 ? results.length - 1 : i - 1));
    } else if (e.key === 'Escape') {
      setOpen(false);
      setActive(-1);
    } else if (e.key === 'Enter' && showList) {
      e.preventDefault();
      add(results[active >= 0 ? active : 0]);
    }
  };

  const full = picks.length >= MAX_COMPARE;
  const goCompare = () => router.push(`/compare?ids=${picks.map((g) => g.id).join(',')}`);

  return (
    <div className="compare-builder">
      <h1 className="cmp-title">게임 비교 만들기</h1>
      <p className="cmp-ai-sub">
        비교할 게임을 2~3개 골라주세요. 싱글 게임끼리, 멀티 게임끼리만 비교할 수 있어요.
      </p>

      {/* 칸 3개 */}
      <div className="cb-slots">
        {Array.from({ length: MAX_COMPARE }).map((_, i) => {
          const g = picks[i];
          return g ? (
            <div key={g.id} className="cb-slot is-filled">
              <GameImage src={g.card_image_url || g.cover_image_url} alt={g.name} />
              <div className="cb-slot-name">{g.name}</div>
              <button type="button" className="cb-slot-remove" aria-label={`${g.name} 빼기`} onClick={() => remove(g.id)}>×</button>
            </div>
          ) : (
            // 빈 칸을 누르면 아래 검색창으로 (키보드·화면 낭독기도 누를 수 있게 버튼)
            <button key={`empty-${i}`} type="button" className="cb-slot is-empty" disabled={full} onClick={() => { inputRef.current?.focus(); inputRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' }); }}>
              <span className="cb-slot-plus" aria-hidden="true">+</span>
              <span className="cb-slot-hint">게임을 추가하세요</span>
            </button>
          );
        })}
      </div>

      {/* 검색 */}
      <div className="search-box cb-search" ref={boxRef}>
        <div className="search-bar-clean">
          <input
            ref={inputRef}
            type="text"
            placeholder={full ? '3개까지 골랐어요' : '게임 이름으로 찾아서 추가...'}
            value={input}
            disabled={full}
            onChange={(e) => { setInput(e.target.value); setOpen(true); setActive(-1); }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
            role="combobox"
            aria-expanded={showList}
            aria-controls="cb-suggest"
            aria-autocomplete="list"
            aria-activedescendant={showList && active >= 0 ? `cb-suggest-${active}` : undefined}
          />
          {input && <button type="button" className="search-clear" aria-label="입력 지우기" onClick={() => { setInput(''); setActive(-1); }}>×</button>}
        </div>
        {showList && (
          <ul className="search-suggest" id="cb-suggest" role="listbox">
            {results.map((g, i) => {
              const picked = picks.some((p) => p.id === g.id);
              return (
                <li key={g.id} role="option" id={`cb-suggest-${i}`} aria-selected={i === active}>
                  <button
                    type="button"
                    className={`search-suggest-item cb-suggest-item${i === active ? ' is-active' : ''}`}
                    onClick={() => add(g)}
                    onMouseEnter={() => setActive(i)}
                    data-picked={picked || undefined}
                  >
                    {g.cover_image_url ? <GameImage src={g.cover_image_url} steamSize="header_292x136" /> : <span className="search-suggest-noimg" />}
                    <span className="search-suggest-name">{g.name}</span>
                    <span className="search-suggest-players">{picked ? '담음' : playersLabel(g)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {open && q && results.length === 0 && (
          <div className="search-suggest cb-suggest-empty">{searching ? '찾는 중...' : '이름이 맞는 게임이 없어요.'}</div>
        )}
      </div>

      {error && <p role="alert" className="cb-error">{error}</p>}

      {/* 검색어가 없을 때 인기 게임 빠른 추가 */}
      {!q && !full && (
        <div className="cb-quick-wrap">
          <div className="filter-label">인기 게임 바로 추가</div>
          <div className="cb-quick">
            {/* 인기 순, 이미 담은 게임은 빼고 6개 — 누르면 다음 빈 칸에 들어감 */}
            {popular.filter((g) => !picks.some((p) => p.id === g.id)).slice(0, QUICK_COUNT).map((g) => (
              <button key={g.id} type="button" className="chip cb-quick-btn" onClick={() => add(g)}>
                + {g.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="cb-go-wrap">
        <button type="button" className="btn btn-primary btn-lg cb-go" disabled={picks.length < 2} onClick={goCompare}>
          {picks.length < 2 ? `게임을 ${2 - picks.length}개 더 골라주세요` : `비교하기 (${picks.length}개)`}
        </button>
      </div>
    </div>
  );
}
