'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import PosterCard, { posterBadge } from './home/mn/PosterCard';
import PosterImage from './home/mn/PosterImage';
import SectionHead from './brand/SectionHead';
import OutboundLink from './OutboundLink';
import { gameName } from '../lib/gameName';
import { getPriceInfo } from '../lib/price';
import { isComingSoon } from '../lib/release';
import { filterSortEntries, type GameEntry, type GameFilter, type GameSort, type PostSection } from '../lib/curatorView';

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
const STACK_MAX = 5; // 겹친 포스터 최대 칸 — 게임이 더 많으면 마지막 칸이 "+N"

const factsOf = (g: Game) => ({
  discount: getPriceInfo(g)?.discount ?? 0,
  multi: (g.max_players ?? 0) >= 2,
  soon: isComingSoon(g),
  reviewPercent: Number(g.review_percent) || 0,
  reviewTotal: Number(g.review_total) || 0,
});
const mmdd = (iso: string) => new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: '2-digit', day: '2-digit' }).format(new Date(iso)).replace(/\.\s*/g, '.').replace(/\.$/, '');
const coverOf = (g: Game) => ({ vertical: g.cover_vertical_url ?? null, appid: g.steam_appid ?? null, wide: g.card_image_url || g.cover_image_url || null });

// 계정 프로필 본문 — 보기 전환(게시물별 / 게임 전체) + 필터·정렬. 보기·열린 게시물은 주소(?view=all, ?post=)에 담겨 뒤로 가기로 목록에 돌아온다
// 게시물별: 게시물 하나 = 카드 하나(겹친 포스터 + 제목 + 날짜·종류·게임 수 + 게임 이름) → 누르면 그 게시물 상세. 필터·정렬은 게시물 카드에도 적용된다
export default function CuratorGames({ curator, games, sections, entries, view, postKey, filterParam, sortParam }: { curator: string; games: Record<string, Game>; sections: Section[]; entries: GameEntry[]; view: View; postKey: string | null; filterParam: string; sortParam: string }) {
  const router = useRouter();
  // 필터·정렬은 주소에 담는다 (같은 주소를 공유하면 같은 보기) — ?f=sale,multi&s=discount (읽기는 CuratorBody)
  const filters = filterParam.split(',').filter((x): x is GameFilter => FILTERS.some((f) => f.key === x));
  const sort: GameSort = SORTS.some((s) => s.key === sortParam) ? (sortParam as GameSort) : 'recent';

  const go = (mut: (u: URL) => void, push = false) => {
    const url = new URL(window.location.href);
    mut(url);
    const href = url.pathname + url.search;
    if (push) router.push(href, { scroll: false }); else router.replace(href, { scroll: false });
  };
  const setView = (v: View) => go((u) => { if (v === 'all') u.searchParams.set('view', 'all'); else u.searchParams.delete('view'); u.searchParams.delete('post'); });
  const toggle = (f: GameFilter) => go((u) => { const next = filters.includes(f) ? filters.filter((x) => x !== f) : [...filters, f]; if (next.length) u.searchParams.set('f', next.join(',')); else u.searchParams.delete('f'); });
  const setSort = (s: GameSort) => go((u) => { if (s === 'recent') u.searchParams.delete('s'); else u.searchParams.set('s', s); });
  const openPost = (key: string) => go((u) => u.searchParams.set('post', key), true);

  const passes = (id: string) => {
    const f = factsOf(games[id]);
    return (!filters.includes('sale') || f.discount > 0) && (!filters.includes('multi') || f.multi) && (!filters.includes('soon') || f.soon);
  };
  // 게시물 카드 — 필터에 맞는 게임이 있는 게시물만, 포스터 스택도 맞는 게임 위주 (정렬: 할인·평가는 게시물 안 최고값 기준)
  const cards = useMemo(() => {
    const list = sections
      .map((s) => ({ s, ids: s.gameIds.filter(passes) }))
      .filter((c) => c.ids.length > 0);
    const best = (ids: string[], pick: (f: ReturnType<typeof factsOf>) => number) => Math.max(...ids.map((id) => pick(factsOf(games[id]))));
    if (sort === 'discount') list.sort((a, b) => best(b.ids, (f) => f.discount) - best(a.ids, (f) => f.discount));
    if (sort === 'review') list.sort((a, b) => best(b.ids, (f) => f.reviewPercent) - best(a.ids, (f) => f.reviewPercent));
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- passes는 filters만 읽는다
  }, [sections, games, filters.join(','), sort]);
  const shown = useMemo(() => filterSortEntries(entries, (e) => factsOf(games[e.gameId]), filters, sort), [entries, games, filters.join(','), sort]); // eslint-disable-line react-hooks/exhaustive-deps

  const open = postKey ? sections.find((s) => s.key === postKey) ?? null : null;

  const controls = (
    <div className="curator-controls">
      <div className="curator-tabs-seg" role="tablist" aria-label="보기 전환">
        {([['posts', '게시물별'], ['all', '게임 전체']] as const).map(([key, label]) => (
          <button key={key} type="button" role="tab" aria-selected={view === key && !open} className="curator-tab" onClick={() => setView(key)}>{label}</button>
        ))}
      </div>
      <div className="curator-control-right">
        <div className="curator-control-row" role="group" aria-label="필터">
          {FILTERS.map((f) => (
            <button key={f.key} type="button" className="mn-chip" aria-pressed={filters.includes(f.key)} onClick={() => toggle(f.key)}>{f.label}</button>
          ))}
        </div>
        <span className="curator-vsep" aria-hidden="true" />
        <div className="curator-control-row" role="group" aria-label="정렬">
          {SORTS.map((o) => (
            <button key={o.key} type="button" className="mn-chip" aria-pressed={sort === o.key} onClick={() => setSort(o.key)}>{o.label}</button>
          ))}
        </div>
      </div>
    </div>
  );

  // ---------- 게시물 상세 ----------
  if (open) {
    return (
      <div className="curator-post-detail">
        <button type="button" className="curator-back" onClick={() => go((u) => u.searchParams.delete('post'), true)}>← 게시물 목록</button>
        <SectionHead id="cp-title" label={`${open.dateText} · ${open.gameIds.length === 1 ? '단일' : '모음'} · 게임 ${open.gameIds.length}개`} title={open.title}
          actions={<OutboundLink href={open.url} curator={curator} gameId={open.gameIds.length === 1 ? open.gameIds[0] : null} className="sec-more">원본 게시물 보기 ↗</OutboundLink>} />
        <ul className="mn-grid">
          {open.gameIds.map((id, i) => <li key={id}><PosterCard game={games[id]} eager={i < 6} badge={posterBadge(games[id])} /></li>)}
        </ul>
      </div>
    );
  }

  return (
    <>
      {controls}
      {view === 'posts' ? (
        cards.length === 0 ? <p className="tl-note">조건에 맞는 게시물이 없어요.</p> : (
          <ul className="curator-cards">
            {cards.map(({ s, ids }) => {
              const over = ids.length > STACK_MAX;
              const stack = over ? ids.slice(0, STACK_MAX - 1) : ids;
              const names = ids.slice(0, 3).map((id) => gameName(games[id])).join(', ');
              return (
                <li key={s.key}>
                  <button type="button" className="curator-card" onClick={() => openPost(s.key)} aria-label={`${s.title} 게시물 보기`}>
                    <span className="curator-stack" aria-hidden="true">
                      {stack.map((id, i) => (
                        <span key={id} className="curator-stack-poster" style={{ '--i': i } as React.CSSProperties}><PosterImage cover={coverOf(games[id])} /></span>
                      ))}
                      {over && <span className="curator-stack-poster curator-stack-more" style={{ '--i': stack.length } as React.CSSProperties}>+{ids.length - stack.length}</span>}
                    </span>
                    <span className="curator-card-title">{s.title}</span>
                    <span className="curator-card-meta">{mmdd(s.postedAt)} · {s.gameIds.length === 1 ? '단일' : '모음'} · 게임 {s.gameIds.length}개</span>
                    <span className="curator-card-games">{names}{ids.length > 3 ? ' 외' : ''}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )
      ) : shown.length === 0 ? (
        <p className="tl-note">조건에 맞는 게임이 없어요.</p>
      ) : (
        <ul className="mn-grid">
          {shown.map((e, i) => (
            <li key={e.gameId} className="curator-game">
              <PosterCard game={games[e.gameId]} eager={i < 6} badge={posterBadge(games[e.gameId])} />
              <div className="curator-game-posts">
                {e.posts.map((p) => (
                  <OutboundLink key={p.id} href={p.url} curator={curator} gameId={e.gameId} className="curator-link">원본 게시물 보기 ↗</OutboundLink>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="curator-note">가격·할인·스팀 평가는 매일 갱신돼요.</p>
    </>
  );
}
