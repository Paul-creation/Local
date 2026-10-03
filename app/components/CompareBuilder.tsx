// 담당: 친구(검색·태그·비교)
'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabase';
import { compareBlockReason, MAX_COMPARE, COMPARE_PICK_KEY, BUILDER_FIELDS } from '../lib/compareRule';
import { matchRank, looseIlikePattern } from '../lib/searchMatch';
import { playersText } from '../lib/players';

const MAX_SUGGESTIONS = 6;

type Pick = { id: string; name: string; search_name_ko?: string | null; card_image_url?: string | null; cover_image_url?: string | null; min_players?: number | null; max_players?: number | null };

const playersLabel = (g: Pick) => playersText(g);

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
  const loaded = useRef(initial.length > 0);

  // 주소로 받은 게임이 없으면, 메인에서 + 비교로 골라둔 게임을 칸에 미리 채움
  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    let ids: string[] = [];
    try { ids = (sessionStorage.getItem(COMPARE_PICK_KEY) || '').split(',').filter(Boolean).slice(0, MAX_COMPARE); } catch {}
    if (!ids.length) return;
    supabase.from('games').select(BUILDER_FIELDS).in('id', ids).then(({ data }) => {
      if (data?.length) setPicks((prev) => (prev.length ? prev : inOrder(ids, data)));
    });
  }, []);

  // 고른 게임을 기억해서, 다시 들어와도 그대로
  useEffect(() => {
    if (!loaded.current) return;
    try {
      if (picks.length) sessionStorage.setItem(COMPARE_PICK_KEY, picks.map((g) => g.id).join(','));
      else sessionStorage.removeItem(COMPARE_PICK_KEY);
    } catch {}
  }, [picks]);

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
      const { data } = await supabase
        .from('games')
        .select(BUILDER_FIELDS)
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
      <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 6 }}>게임 비교 만들기</h1>
      <p style={{ fontSize: 15, color: 'var(--text-dim)', marginBottom: 20 }}>
        비교할 게임을 2~3개 골라주세요. 싱글 게임끼리, 멀티 게임끼리만 비교할 수 있어요.
      </p>

      {/* 칸 3개 */}
      <div className="cb-slots">
        {Array.from({ length: MAX_COMPARE }).map((_, i) => {
          const g = picks[i];
          return g ? (
            <div key={g.id} className="cb-slot is-filled">
              <img src={g.card_image_url || g.cover_image_url || ''} alt={g.name} />
              <div className="cb-slot-name">{g.name}</div>
              <button className="cb-slot-remove" aria-label={`${g.name} 빼기`} onClick={() => remove(g.id)}>✕</button>
            </div>
          ) : (
            <div key={`empty-${i}`} className="cb-slot">
              <span>{i + 1}번째 게임</span>
            </div>
          );
        })}
      </div>

      {/* 검색 */}
      <div className="search-box cb-search" ref={boxRef}>
        <div className="search-bar-clean">
          <input
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
          {input && <button className="search-clear" aria-label="입력 지우기" onClick={() => { setInput(''); setActive(-1); }}>✕</button>}
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
                    style={picked ? { opacity: 0.5 } : undefined}
                  >
                    {g.cover_image_url ? <img src={g.cover_image_url} alt="" /> : <span className="search-suggest-noimg" />}
                    <span className="search-suggest-name">{g.name}</span>
                    <span className="search-suggest-players">{picked ? '담음' : playersLabel(g)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {open && q && results.length === 0 && (
          <div className="search-suggest" style={{ padding: '14px 16px', fontSize: 15, color: 'var(--text-dim)' }}>{searching ? '찾는 중...' : '이름이 맞는 게임이 없어요.'}</div>
        )}
      </div>

      {error && <p role="alert" style={{ marginTop: 10, fontSize: 15, fontWeight: 700, color: 'var(--danger)' }}>{error}</p>}

      {/* 검색어가 없을 때 인기 게임 빠른 추가 */}
      {!q && popular.length > 0 && !full && (
        <div style={{ marginTop: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-dim)', marginBottom: 10 }}>🔥 인기 게임 바로 추가</div>
          <div className="cb-quick">
            {popular.map((g) => {
              const picked = picks.some((p) => p.id === g.id);
              return (
                <button key={g.id} type="button" className="cb-quick-btn" disabled={picked} onClick={() => add(g)}>
                  {picked ? '✓ ' : '+ '}{g.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ marginTop: 28, display: 'flex', justifyContent: 'center' }}>
        <button type="button" className="cb-go" disabled={picks.length < 2} onClick={goCompare}>
          {picks.length < 2 ? `게임을 ${2 - picks.length}개 더 골라주세요` : `비교하기 (${picks.length}개)`}
        </button>
      </div>
    </div>
  );
}
