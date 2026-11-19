'use client';

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { HOWS, GENRES, EMPTY_QUERY, countFitting, countMatching, isEmptyQuery, queryHref, summaryParts, type AbQuery, type GenreKey, type GenreMode } from '../../../lib/abSearch';
import { makeAbCtx, makeKwMatcher } from '../../../lib/abCtx';
import { useGameIndex } from '../../../lib/useGameIndex';
import { matchRank } from '../../../lib/searchMatch';
import { gameName } from '../../../lib/gameName';
import './ab.css';

// 에어비앤비식 3칸 검색창 — 누구랑(인원) · 어떻게(방식) · 뭐 할까(장르·직접 입력). 모든 칸은 선택이고, 비우고 찾으면 인기순
// 데스크톱: 가로 막대 하나 + 칸 아래에 패널(열린 칸은 --ink 배경). 휴대폰(767px 이하): 알약 하나 → 전체 화면 시트에서 3칸이 차례로 펼쳐짐
// 두 모양을 모두 그리고 CSS(ab.css)로 가른다 — 마운트 전후 차이 없음
// 열린 칸은 --surface-open 배경 + 안쪽 테두리, 팝오버 안 선택 표시는 크림 채움만 (괄호 없음). 팝오버는 z-index 40 (docs/design/SearchPopovers.dc.html)
// 값은 바뀌는 즉시 입력 상태에 반영되고, 팝오버 푸터는 "지우기 / 완료"(완료는 닫기만). 뭐 할까 푸터만 "N개 보기"(결과 수 표시, 누르면 찾기)
// variant="results": 결과 화면 맨 위 — 데스크톱은 늘 펼친 막대("다시 찾기"), 휴대폰은 접힌 알약 한 줄
type Cell = 'who' | 'how' | 'what';

export default function AbSearch({ games, initial = EMPTY_QUERY, variant = 'home', trailing, onSubmit }: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 게임 칸은 목록(gameIndex)과 같은 느슨한 모양
  games: any[] | null;
  initial?: AbQuery;
  variant?: 'home' | 'results';
  trailing?: ReactNode; // 검색창 오른쪽에 붙일 것 (홈: AI 추천 버튼)
  onSubmit?: (q: AbQuery) => void;
}) {
  const router = useRouter();
  const [q, setQ] = useState<AbQuery>(initial);
  const [open, setOpen] = useState<Cell | null>(null);
  const [sheet, setSheet] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false); // 시트는 body로 포털 — 헤더(z 50)·비교 트레이(z 800) 위, 헤더도 어둡게 덮인다

  // 결과 화면에서 주소가 바뀌면(상황 타일·조건 칩·뒤로가기) 입력창도 그 조건으로
  const initialKey = JSON.stringify(initial);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 바깥(주소)이 바뀔 때 입력창을 맞추는 동기화
    setQ(JSON.parse(initialKey));
  }, [initialKey]);

  // 바깥을 누르거나 Esc면 패널 닫기 (데스크톱)
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (wrapRef.current && !wrapRef.current.contains(e.target as Node) && !(e.target as Element).closest?.('.ab-sheet')) setOpen(null); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(null); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  // 시트가 열려 있는 동안 뒤 화면이 스크롤되지 않게
  useEffect(() => {
    if (!sheet) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSheet(false); };
    document.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; document.removeEventListener('keydown', onKey); };
  }, [sheet]);

  const submit = (next: AbQuery = q) => {
    setOpen(null);
    setSheet(false);
    if (onSubmit) onSubmit(next);
    else router.push(queryHref(next));
  };

  const index = useGameIndex(); // 목록·태그 나무는 메인·결과 화면과 같은 캐시를 쓴다
  const ctx = useMemo(() => makeAbCtx(index.tree), [index.tree]);
  const kwMatch = useMemo(() => makeKwMatcher(index.tree), [index.tree]);
  const matching = games ? countMatching(games, q, ctx, kwMatch) : null;

  const sum = summaryParts(q);
  const fits = (n: number) => (games ? countFitting(games, n) : null);

  // ---------- 칸 안의 패널 (데스크톱 팝오버와 모바일 시트가 같이 쓴다) ----------
  const who = (
    <WhoPanel n={q.n} count={q.n ? fits(q.n) : null} onChange={(n) => setQ({ ...q, n })} onClear={() => setQ({ ...q, n: null })} onDone={() => setOpen(null)} />
  );
  const how = (
    <HowPanel how={q.how} onChange={(h) => { setQ({ ...q, how: q.how === h ? null : h }); }} onClear={() => setQ({ ...q, how: null })} onDone={() => setOpen(null)} />
  );
  const what = (
    <WhatPanel games={games} kw={q.kw} genres={q.genres} gm={q.gm} matching={matching} onKw={(kw) => setQ({ ...q, kw })} onGenres={(genres) => setQ({ ...q, genres })} onGm={(gm) => setQ({ ...q, gm })} onClear={() => setQ({ ...q, kw: '', genres: [] })} onShow={() => submit()} onEnter={() => submit()} />
  );

  const cells: { key: Cell; label: string; value: string; empty: string; panel: ReactNode }[] = [
    { key: 'who', label: '누구랑', value: sum.who, empty: '인원 추가', panel: who },
    { key: 'how', label: '어떻게', value: sum.how, empty: '방식 선택', panel: how },
    { key: 'what', label: '뭐 할까', value: sum.what, empty: '장르·게임 검색', panel: what },
  ];

  const pillMain = isEmptyQuery(q) ? '누구랑 할 거야?' : [sum.who, sum.how, sum.what].filter(Boolean).join(' · ');

  return (
    <div className={`ab ab-${variant}`} ref={wrapRef}>
      <div className="ab-row">
        {/* ----- 데스크톱 ----- */}
        <div className="ab-bar ab-desktop" role="group" aria-label="게임 찾기">
          {cells.map((c) => (
            <div key={c.key} className="ab-slot">
              <button
                type="button"
                className={`ab-cell${c.value ? ' has-value' : ''}${open === c.key ? ' is-open' : ''}`}
                data-tour={variant === 'home' ? `ab-${c.key}` : undefined}
                aria-expanded={open === c.key}
                aria-controls={`ab-panel-${c.key}`}
                onClick={() => setOpen(open === c.key ? null : c.key)}
              >
                <span className="ab-cell-label">{c.label}</span>
                <span className={`ab-cell-value${c.value ? '' : ' is-empty'}`}>{c.value || c.empty}</span>
              </button>
              {open === c.key && (
                <Popover id={`ab-panel-${c.key}`} cell={c.key} label={c.label}>{c.panel}</Popover>
              )}
            </div>
          ))}
          <button type="button" className="ab-go" data-tour={variant === 'home' ? 'ab-go' : undefined} onClick={() => submit()}>{variant === 'results' ? '다시 찾기' : '찾기'}</button>
        </div>

        {/* ----- 휴대폰 ----- */}
        <button type="button" className={`ab-pill ab-mobile${isEmptyQuery(q) ? '' : ' has-value'}`} data-tour={variant === 'home' ? 'ab-pill' : undefined} onClick={() => { setSheet(true); setOpen('who'); }} aria-haspopup="dialog">
          <span className="ab-pill-text">
            <span className="ab-pill-main">{pillMain}</span>
            {isEmptyQuery(q) && variant === 'home' && <span className="ab-pill-sub">인원 · 방식 · 장르</span>}
          </span>
          {variant === 'results' ? <span className="ab-pill-edit">바꾸기</span> : <span className="ab-pill-go" aria-hidden="true">→</span>}
        </button>
        {trailing && <div className="ab-trailing">{trailing}</div>}
      </div>

      {sheet && mounted && createPortal(
        <div className="ab-sheet ab-mobile" onClick={(e) => { if (e.target === e.currentTarget) setSheet(false); }}>
          <div className="ab-sheet-panel" role="dialog" aria-modal="true" aria-label="게임 찾기">
            <div className="ab-sheet-grip" aria-hidden="true"><span /></div>
            <div className="ab-sheet-head">
              <strong>누구랑 할 거야?</strong>
              <button type="button" className="ab-sheet-close" onClick={() => setSheet(false)} aria-label="닫기">✕</button>
            </div>
            <div className="ab-sheet-body">
              {cells.map((c, i) => (
                <section key={c.key} className={`ab-acc${open === c.key ? ' is-open' : ''}`}>
                  <button type="button" className="ab-acc-head" aria-expanded={open === c.key} onClick={() => setOpen(open === c.key ? null : c.key)}>
                    <span className="ab-cell-label">{c.label}</span>
                    <span className={`ab-cell-value${c.value ? '' : ' is-empty'}`}>{c.value || c.empty}</span>
                  </button>
                  {open === c.key && (
                    <div className="ab-acc-body">
                      {c.panel}
                      {i < cells.length - 1 && <button type="button" className="ab-next" onClick={() => setOpen(cells[i + 1].key)}>다음 →</button>}
                    </div>
                  )}
                </section>
              ))}
            </div>
            <div className="ab-sheet-foot">
              <button type="button" className="ab-clear" onClick={() => setQ({ ...EMPTY_QUERY, opts: q.opts })}>전체 지우기</button>
              <button type="button" className="ab-go" onClick={() => submit()}>{matching == null || isEmptyQuery(q) ? '찾기' : `${matching.toLocaleString('ko-KR')}개 찾기`}</button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}

// ---------- 팝오버 (데스크톱) ----------
// 연 칸의 왼쪽 아래 12px. 오른쪽이 화면 밖으로 나가면 칸의 오른쪽에 맞춘다 — 그려진 직후(화면에 보이기 전) 한 번 재서 정한다
function Popover({ id, cell, label, children }: { id: string; cell: Cell; label: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [flip, setFlip] = useState(false);
  useLayoutEffect(() => {
    const el = ref.current;
    if (el && el.getBoundingClientRect().right > window.innerWidth - 8) setFlip(true);
  }, []);
  return (
    <div ref={ref} id={id} className={`ab-panel ab-panel-${cell}${flip ? ' is-flip' : ''}`} role="dialog" aria-label={label}>
      {children}
    </div>
  );
}

// 푸터 "지우기 / 완료" (휴대폰 시트에서는 시트 푸터가 대신해서 CSS로 숨김)
function PanelFoot({ onClear, onDone, doneLabel = '완료' }: { onClear: () => void; onDone: () => void; doneLabel?: string }) {
  return (
    <div className="ab-pfoot">
      <button type="button" className="ab-pclear" onClick={onClear}>지우기</button>
      <button type="button" className="ab-pdone" onClick={onDone}>{doneLabel}</button>
    </div>
  );
}

// ---------- 누구랑 ----------
const WHO_CHIPS: { label: string; n: number; on: (n: number | null) => boolean }[] = [
  { label: '혼자', n: 1, on: (n) => n === 1 },
  { label: '둘이서', n: 2, on: (n) => n === 2 },
  { label: '3~4명', n: 4, on: (n) => n === 3 || n === 4 },
  { label: '5명 이상', n: 5, on: (n) => n != null && n >= 5 },
];
function WhoPanel({ n, count, onChange, onClear, onDone }: { n: number | null; count: number | null; onChange: (n: number | null) => void; onClear: () => void; onDone: () => void }) {
  const labelId = useId();
  return (
    <div className="ab-who">
      <div className="ab-stepper">
        <div className="ab-stepper-text">
          <span id={labelId} className="ab-stepper-label">같이 할 사람</span>
          <span className="ab-stepper-sub">나 포함 인원</span>
        </div>
        <div className="ab-stepper-ctl" role="group" aria-labelledby={labelId}>
          <button type="button" className="ab-step" aria-label="한 명 줄이기" disabled={n == null} onClick={() => onChange(n == null || n <= 1 ? null : n - 1)}>−</button>
          <output className={`ab-step-num${n == null ? ' is-empty' : ''}`} aria-live="polite">{n ?? 0}</output>
          <button type="button" className="ab-step" aria-label="한 명 늘리기" disabled={n != null && n >= 16} onClick={() => onChange(n == null ? 2 : n + 1)}>+</button>
        </div>
      </div>
      <div className="ab-chips">
        {WHO_CHIPS.map((c) => (
          <button key={c.label} type="button" className={`ab-pchip${c.on(n) ? ' is-on' : ''}`} aria-pressed={c.on(n)} onClick={() => onChange(c.on(n) ? null : c.n)}>{c.label}</button>
        ))}
      </div>
      {n != null && (
        <p className="ab-count">{n}명이 같이 할 수 있는 게임 <strong>{count == null ? '…' : count.toLocaleString('ko-KR')}</strong>개</p>
      )}
      <PanelFoot onClear={onClear} onDone={onDone} />
    </div>
  );
}

// ---------- 어떻게 ----------
function HowPanel({ how, onChange, onClear, onDone }: { how: AbQuery['how']; onChange: (h: NonNullable<AbQuery['how']>) => void; onClear: () => void; onDone: () => void }) {
  return (
    <div className="ab-how-panel">
      <div className="ab-tiles ab-tiles-how" role="radiogroup" aria-label="어떻게">
        {HOWS.map((h) => (
          <button key={h.key} type="button" role="radio" aria-checked={how === h.key} className={`ab-tile${how === h.key ? ' is-on' : ''}`} onClick={() => onChange(h.key)}>{h.label}</button>
        ))}
      </div>
      <PanelFoot onClear={onClear} onDone={onDone} />
    </div>
  );
}

// ---------- 뭐 할까 ----------
const GM_OPTIONS: { key: GenreMode; label: string }[] = [
  { key: 'any', label: '하나라도' },
  { key: 'all', label: '모두' },
];
function WhatPanel({ games, kw, genres, gm, matching, onKw, onGenres, onGm, onClear, onShow, onEnter }: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  games: any[] | null; kw: string; genres: GenreKey[]; gm: GenreMode; matching: number | null;
  onKw: (kw: string) => void; onGenres: (g: GenreKey[]) => void; onGm: (gm: GenreMode) => void; onClear: () => void; onShow: () => void; onEnter: () => void;
}) {
  // 입력이 게임 이름과 맞으면 게임 페이지 바로가기 (이름이 앞에서부터 맞는 것 먼저, 최대 4개)
  const hits = useMemo(() => {
    if (!games || kw.trim().length < 2) return [];
    return games
      .map((g) => ({ g, r: matchRank(g, kw) }))
      .filter((x) => x.r >= 0)
      .sort((a, b) => a.r - b.r || (a.g.heat_rank ?? Infinity) - (b.g.heat_rank ?? Infinity))
      .slice(0, 4)
      .map((x) => x.g);
  }, [games, kw]);
  const toggle = (k: GenreKey) => onGenres(genres.includes(k) ? genres.filter((x) => x !== k) : [...genres, k]);
  return (
    <div className="ab-what">
      <label className="ab-input">
        <span className="ab-sr">게임 이름이나 키워드</span>
        <input
          type="search"
          value={kw}
          maxLength={40}
          placeholder="게임 이름이나 키워드 (예: 좀비, 리썰컴퍼니)"
          onChange={(e) => onKw(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onEnter(); } }}
        />
      </label>
      {hits.length > 0 && (
        <ul className="ab-hits" aria-label="게임 바로가기">
          {hits.map((g) => (
            <li key={g.id}><Link href={`/games/${g.id}`} className="ab-hit"><span>{gameName(g)}</span><span className="ab-hit-go">게임 페이지 →</span></Link></li>
          ))}
        </ul>
      )}
      <div className="ab-tiles" role="group" aria-label="장르">
        {GENRES.map((t) => (
          <button key={t.key} type="button" className={`ab-tile${genres.includes(t.key) ? ' is-on' : ''}`} aria-pressed={genres.includes(t.key)} onClick={() => toggle(t.key)}>{t.label}</button>
        ))}
      </div>
      <div className="ab-gm" role="group" aria-label="장르를 여러 개 고르면">
        <span>여러 개 고르면</span>
        {GM_OPTIONS.map((o) => (
          <button key={o.key} type="button" className={`ab-gm-btn${gm === o.key ? ' is-on' : ''}`} aria-pressed={gm === o.key} onClick={() => onGm(o.key)}>{o.label}</button>
        ))}
      </div>
      <PanelFoot onClear={onClear} onDone={onShow} doneLabel={matching == null ? '보기' : `${matching.toLocaleString('ko-KR')}개 보기`} />
    </div>
  );
}
