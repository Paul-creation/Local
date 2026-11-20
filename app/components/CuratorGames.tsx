'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import GameLink from './GameLink';
import CuratorPoster from './CuratorPoster';
import OutboundLink from './OutboundLink';
import { gameName } from '../lib/gameName';
import { getPriceInfo, PRICE_TYPE_LABEL } from '../lib/price';
import { playersText } from '../lib/players';
import { isComingSoon, comingSoonLabel, hasDemo } from '../lib/release';
import { type GameFilter, type GameSort, type PostSection } from '../lib/curatorView';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- 게임 카드 칸은 목록(gameIndex)과 같은 느슨한 모양
type Game = any;
export type Tab = 'single' | 'collection';

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
const mmdd = (iso: string) => new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: '2-digit', day: '2-digit' }).format(new Date(iso)).replace(/\.\s*/g, '.').replace(/\.$/, '');
// 따옴표 한 겹으로 감싸 보여준다 (저장된 제목에 이미 따옴표가 있으면 벗기고 다시)
const quoted = (t: string) => `“${t.trim().replace(/^["“”'‘’]+|["“”'‘’]+$/g, '')}”`;

// 가격 줄 — 출시 예정(데모 여부) / 무료 / 월 구독·판매처 / 할인 배지 + 가격 + 정가(있을 때만)
function PriceLine({ game }: { game: Game }) {
  const price = getPriceInfo(game);
  if (isComingSoon(game)) return <span className="cg-soon">{comingSoonLabel(game)}{hasDemo(game) ? ' · 데모 있음' : ''}</span>;
  if (game.is_free) return <span className="cg-price"><b>무료</b></span>;
  if (PRICE_TYPE_LABEL[game.price_type]) return <span className="cg-price"><b className="cg-price-text">{PRICE_TYPE_LABEL[game.price_type]}</b></span>;
  if (!price) return null;
  return (
    <span className="cg-price">
      {price.discount > 0 && <span className="cg-sale">-{price.discount}%</span>}
      <b>{price.formattedFinal}</b>
      {price.discount > 0 && price.formattedOriginal && <s>{price.formattedOriginal}</s>}
    </span>
  );
}

// 인스타그램 원본 게시물 버튼 — 32×32 원형, 아이콘만(Meta 공식 글리프)
function InstaButton({ url, curator, gameId }: { url: string; curator: string; gameId: string | null }) {
  return (
    <OutboundLink href={url} curator={curator} gameId={gameId} className="cg-ig" aria-label="인스타그램 원본 게시물" title="인스타그램 원본 게시물">
      <img src="/brand/instagram-glyph.svg" alt="" width={14} height={14} />
    </OutboundLink>
  );
}

// 계정 프로필 본문 — 탭 "단일 소개 N / 모음집 N"(post_type 기준) + 필터·정렬(두 탭 모두 적용)
// 탭·필터·정렬은 주소(?view=single|collection, ?f=, ?s=)에 담는다 (읽기는 CuratorBody). 예전 ?view=all은 단일, ?post=<주소>는 그 게시물이 속한 탭으로 본다
export default function CuratorGames({ curator, games, sections, tab, filterParam, sortParam }: { curator: string; games: Record<string, Game>; sections: PostSection[]; tab: Tab; filterParam: string; sortParam: string }) {
  const router = useRouter();
  const filters = filterParam.split(',').filter((x): x is GameFilter => FILTERS.some((f) => f.key === x));
  const sort: GameSort = SORTS.some((s) => s.key === sortParam) ? (sortParam as GameSort) : 'recent';

  const go = (mut: (u: URL) => void) => {
    const url = new URL(window.location.href);
    mut(url);
    router.replace(url.pathname + url.search, { scroll: false });
  };
  const setTab = (t: Tab) => go((u) => { u.searchParams.set('view', t); u.searchParams.delete('post'); });
  const toggle = (f: GameFilter) => go((u) => { const next = filters.includes(f) ? filters.filter((x) => x !== f) : [...filters, f]; if (next.length) u.searchParams.set('f', next.join(',')); else u.searchParams.delete('f'); });
  const setSort = (s: GameSort) => go((u) => { if (s === 'recent') u.searchParams.delete('s'); else u.searchParams.set('s', s); });

  const filterKey = filters.join(',');
  // 탭 숫자는 필터와 상관없는 전체 게시물 수. 목록은 필터에 맞는 게임만 남기고(모음집은 그 게임들만), 남은 게임이 없는 게시물은 숨긴다
  const counts = useMemo(() => ({ single: sections.filter((s) => s.postType === 'single').length, collection: sections.filter((s) => s.postType === 'collection').length }), [sections]);
  const cards = useMemo(() => {
    const passes = (id: string) => {
      const f = factsOf(games[id]);
      return (!filters.includes('sale') || f.discount > 0) && (!filters.includes('multi') || f.multi) && (!filters.includes('soon') || f.soon);
    };
    const pick = (id: string) => (sort === 'discount' ? factsOf(games[id]).discount : sort === 'review' ? factsOf(games[id]).reviewPercent : 0);
    const list = sections
      .filter((s) => s.postType === tab)
      .map((s) => {
        const ids = s.gameIds.filter(passes);
        return { s, ids: sort === 'recent' ? ids : [...ids].sort((a, b) => pick(b) - pick(a)) };
      })
      .filter((c) => c.ids.length > 0);
    if (sort !== 'recent') list.sort((a, b) => pick(b.ids[0]) - pick(a.ids[0])); // 게시물 순서는 안 남은 게임 중 최고값 기준 (정렬은 안정)
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- passes는 filters만 읽는다
  }, [sections, games, tab, filterKey, sort]);

  return (
    <>
      <div className="curator-controls">
        <div className="curator-tabs-seg" role="tablist" aria-label="보기 전환">
          {([['single', '단일 소개'], ['collection', '모음집']] as const).map(([key, label]) => (
            <button key={key} type="button" role="tab" aria-selected={tab === key} className="curator-tab" onClick={() => setTab(key)}>{label} <span className="curator-tab-n">{counts[key]}</span></button>
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

      {cards.length === 0 ? (
        <p className="tl-note">{filters.length ? '조건에 맞는 게시물이 없어요.' : tab === 'single' ? '단일 소개 게시물이 없어요.' : '모음집 게시물이 없어요.'}</p>
      ) : tab === 'single' ? (
        <ul className="cg-single">
          {cards.map(({ s, ids }, i) => {
            const g = games[ids[0]];
            const rating = g.review_percent ? `${g.review_summary ? `${g.review_summary} ` : ''}${g.review_percent}%` : '';
            const info = [playersText(g), rating].filter(Boolean).join(' · ');
            return (
              <li key={s.key} className="cg-card">
                <CuratorPoster game={g} eager={i < 3} />
                <span className="cg-body">
                  {s.titled && <span className="cg-quote">{quoted(s.title)}</span>}
                  <span className="cg-names">
                    <span className="cg-orig">{g.name ?? gameName(g)}</span>
                    {info && <span className="cg-info">{info}</span>}
                  </span>
                  <span className="cg-foot">
                    <PriceLine game={g} />
                    <span className="cg-date">{mmdd(s.postedAt)}</span>
                  </span>
                </span>
                {/* 카드 전체가 게임 상세 링크(::after로 덮음), 인스타 버튼만 그 위 */}
                <GameLink href={`/games/${g.id}`} className="cg-cover" aria-label={`${gameName(g)} 게임 정보`} />
                <span className="cg-ig-slot"><InstaButton url={s.url} curator={curator} gameId={g.id} /></span>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="cg-colls">
          {cards.map(({ s, ids }) => (
            <section key={s.key} className="cg-coll">
              <div className="cg-coll-head">
                <div className="cg-coll-title">
                  <span className="cg-coll-label">모음집 · 게임 {ids.length}개</span>
                  <h3>{s.titled ? quoted(s.title) : s.title}</h3>
                </div>
                <span className="cg-coll-right">{mmdd(s.postedAt)}<InstaButton url={s.url} curator={curator} gameId={null} /></span>
              </div>
              <ul className="cg-coll-grid">
                {ids.map((id) => {
                  const g = games[id];
                  return (
                    <li key={id}>
                      <GameLink href={`/games/${id}`} className="cg-coll-item">
                        <CuratorPoster game={g} />
                        <span className="cg-coll-name">{gameName(g)}</span>
                        {playersText(g) && <span className="cg-coll-players">{playersText(g)}</span>}
                        <PriceLine game={g} />
                      </GameLink>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
      <p className="curator-note">가격·할인·스팀 평가는 매일 갱신돼요.</p>
    </>
  );
}
