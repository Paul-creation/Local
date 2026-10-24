'use client';

import { useCallback, useMemo, useState } from 'react';
import GameCard from './home/GameCard';
import { buildTree, type TagDict } from '../lib/tagTree';
import tagDict from '../lib/tag-search-dict.json';
import { getPriceInfo } from '../lib/price';
import { isComingSoon } from '../lib/release';
import { filterSortEntries, type GameEntry, type GameFilter, type GameSort, type PostSection } from '../lib/curatorView';

const TREE = buildTree(tagDict as unknown as TagDict);

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- 게임 카드 칸은 목록(gameIndex)과 같은 느슨한 모양
type Game = any;
type View = 'posts' | 'all';
type Section = PostSection & { dateText: string };

const FILTERS: { key: GameFilter; label: string }[] = [
  { key: 'sale', label: '지금 할인 중' },
  { key: 'multi', label: '친구랑 멀티' },
  { key: 'soon', label: '출시 예정' },
];
const SORTS: { key: GameSort; label: string }[] = [
  { key: 'recent', label: '최근 소개순' },
  { key: 'discount', label: '할인 큰 순' },
  { key: 'review', label: '평가순' },
];

const factsOf = (g: Game) => ({
  discount: getPriceInfo(g)?.discount ?? 0,
  multi: (g.max_players ?? 0) >= 2,
  soon: isComingSoon(g),
  reviewPercent: Number(g.review_percent) || 0,
  reviewTotal: Number(g.review_total) || 0,
});

// 계정 프로필 본문 — 보기 전환(게시물별 / 게임 전체). 보기는 주소 ?view=all로 유지(기본 게시물별)
export default function CuratorGames({ games, sections, entries, initialView = 'posts' }: { games: Record<string, Game>; sections: Section[]; entries: GameEntry[]; initialView?: View }) {
  const [view, setViewState] = useState<View>(initialView);
  const [filters, setFilters] = useState<GameFilter[]>([]);
  const [sort, setSort] = useState<GameSort>('recent');

  const setView = useCallback((v: View) => {
    setViewState(v);
    const url = new URL(window.location.href);
    if (v === 'all') url.searchParams.set('view', 'all');
    else url.searchParams.delete('view');
    window.history.replaceState(null, '', url);
  }, []);

  const shown = useMemo(() => filterSortEntries(entries, (e) => factsOf(games[e.gameId]), filters, sort), [entries, games, filters, sort]);
  const toggle = (f: GameFilter) => setFilters((cur) => (cur.includes(f) ? cur.filter((x) => x !== f) : [...cur, f]));

  return (
    <>
      <div className="curator-tabs" role="tablist" aria-label="보기 전환">
        {([['posts', '게시물별'], ['all', '게임 전체']] as const).map(([key, label]) => (
          <button key={key} type="button" role="tab" aria-selected={view === key} className="curator-tab" onClick={() => setView(key)}>
            {label}
          </button>
        ))}
      </div>

      {view === 'posts' ? (
        <div className="curator-sections">
          {sections.map((s) => (
            <section key={s.key} className="curator-section" aria-label={s.title}>
              <div className="curator-section-head">
                <h2 className="curator-section-title">{s.title}</h2>
                <span className="curator-section-date">{s.dateText}</span>
                <a href={s.url} target="_blank" rel="noopener noreferrer" className="curator-link">원본 게시물 보기 ↗</a>
              </div>
              <ul className="curator-games">
                {s.gameIds.map((id) => (
                  <li key={id} className="curator-game"><GameCard game={games[id]} tree={TREE} /></li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : (
        <>
          <div className="curator-controls">
            <div className="curator-control-row" role="group" aria-label="필터">
              {FILTERS.map((f) => (
                <button key={f.key} type="button" className="chip" aria-pressed={filters.includes(f.key)} onClick={() => toggle(f.key)}>{f.label}</button>
              ))}
            </div>
            <div className="curator-control-row" role="group" aria-label="정렬">
              <span className="curator-control-label">정렬</span>
              {SORTS.map((o) => (
                <button key={o.key} type="button" className="chip" aria-pressed={sort === o.key} onClick={() => setSort(o.key)}>{o.label}</button>
              ))}
            </div>
          </div>
          {shown.length === 0 ? (
            <p className="tl-note">조건에 맞는 게임이 없어요.</p>
          ) : (
            <ul className="curator-games">
              {shown.map((e) => (
                <li key={e.gameId} className="curator-game">
                  <GameCard game={games[e.gameId]} tree={TREE} />
                  <div className="curator-game-posts">
                    {e.posts.map((p) => (
                      <a key={p.id} href={p.url} target="_blank" rel="noopener noreferrer" className="curator-link">원본 게시물 보기 ↗</a>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </>
  );
}
