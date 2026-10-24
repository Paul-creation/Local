'use client';

// 게임 카드 공통 컴포넌트 — 메인(인원별 추천·찜 기반 추천·지금 뜨는 게임 1~3위·스트리머 협동)·검색 결과·계정 페이지·찜목록이 같이 쓴다 (이번주의 게임 가로 카드·행 보기·상세의 compact 카드는 따로)
// 위→아래: 이미지(왼쪽 위에 순위 배지 또는 뜨는 중·신작 배지) → 이름 → 인원·진입장벽 한 줄 → Steam 평가 한 줄 → 칩 줄(무료 데모·TOP 10·GOTY·태그 최대 2·크로스플레이·한국어 미지원, 한 줄 고정 — 넘치면 +N 칩) → 스트리머 칩(children 또는 game.streamers) → 가격(맨 아래에 붙음, 역대 최저가 칩은 가격 줄 오른쪽 끝, compare를 넘기면 오른쪽에 "+ 비교")
// 값이 없는 줄·칩은 숨긴다. 동접·소개문은 넣지 않는다. 게임 칸 모양은 목록(gameIndex)·카드 조회와 같은 느슨한 모양 (태그는 top_tags 또는 tag_ids+tree, 평가·한국어는 목록/카드 조회가 넣어 줌)
import type { ReactNode } from 'react';
import Link from 'next/link';
import { getPriceInfo, getLowestTiming, PRICE_TYPE_LABEL } from '../../lib/price';
import { playersText } from '../../lib/players';
import { reviewTone } from '../../lib/review';
import { barrierLabel, infoChips, TAG_LIMIT } from '../../lib/cardInfo';
import { displayTags, type TagTree } from '../../lib/tagTree';
import LowestPriceBadge from '../LowestPriceBadge';
import SaleEnds from '../SaleEnds';
import GotyBadge from '../GotyBadge';
import GameImage, { type SteamSize } from '../GameImage';
import OwnedChip from '../owned/OwnedChip';
import ChipRow from './ChipRow';
import StreamerBadge from './StreamerBadge';
import { gameName } from '../../lib/gameName';
import { isComingSoon, hasDemo, comingSoonLabel } from '../../lib/release';

// 스팀 외 스토어 이름 (games.source)
const STORE_NAME: Record<string, string> = { epic: 'Epic', battlenet: 'Battle.net', riot: 'Riot', ea: 'EA app', ubisoft: 'Ubisoft Connect', gog: 'GOG' };

// games.trend_badge 저장값 → 이미지 위 배지 글자 (app/lib/trending.ts BADGE_KEY와 같은 짝)
const TREND_LABEL: Record<string, string> = { new: '신작', rising_old: '다시 뜨는 중', rising_recent: '요즘 뜨는 중' };

type Props = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 게임 카드 칸은 목록(gameIndex)과 같은 느슨한 모양
  game: any;
  badge?: ReactNode;                                      // 이미지 위 왼쪽 위 (지금 뜨는 게임 순위 배지). 없으면 game.trend_badge로 뜨는 중·신작 배지
  tree?: TagTree | null;                                  // 목록(gameIndex)의 tag_ids를 태그 이름으로 바꿀 나무. top_tags가 이미 있으면 안 쓴다
  isTop10?: boolean;                                      // 오늘 TOP 10이면 칩 줄에 "TOP 10"
  onClick?: () => void;
  compare?: { selected: boolean; disabled: boolean; onToggle: () => void }; // 검색 결과만 — 가격 줄 오른쪽 "+ 비교"
  image?: string | null;                                  // 기본은 cover → card 이미지
  imgProps?: { steamSize?: SteamSize; fallbackWidth?: number };
  eager?: boolean;
  ariaLabel?: string;
  className?: string;
  stretched?: boolean;                                    // 카드 안에 링크·버튼(스트리머 칩 등)이 있을 때 — 카드를 <a>로 감싸지 않고 이름 링크의 ::after가 카드 전체를 덮는다(a 안에 a 금지)
  children?: ReactNode;                                   // 스트리머 칩 줄 대신 쓸 줄 (영상 링크 칩 등). 없으면 game.streamers 이름 칩
};

export default function GameCard({ game, badge, tree = null, isTop10 = false, onClick, compare, image, imgProps = { steamSize: 'header' }, eager = false, ariaLabel, className = '', stretched = false, children }: Props) {
  const price = getPriceInfo(game);
  const players = playersText(game);
  const barrier = barrierLabel(game);
  const chips = infoChips(game.top_tags ? game : { ...game, top_tags: displayTags(tree, game, TAG_LIMIT) });
  const hasGoty = Array.isArray(game.goty_awards) && game.goty_awards.length > 0;
  const comingSoon = isComingSoon(game);
  const demo = hasDemo(game);
  const store = game.steam_appid ? null : STORE_NAME[game.source] ?? '기타 스토어';
  const pct: number | null = game.review_percent || null;
  const summary: string | null = game.review_summary ?? null;
  const trendLabel = TREND_LABEL[game.trend_badge as string];
  const topBadge = badge ?? (trendLabel ? <span className="gc-trend"><span>{trendLabel}</span></span> : null);
  const streamers: string[] = Array.isArray(game.streamers) ? game.streamers : [];
  const isPicked = !!compare?.selected;
  const body = (
    <>
      <span className="gc-image">
        <GameImage src={image ?? (game.cover_image_url || game.card_image_url)} alt="" loading={eager ? 'eager' : 'lazy'} {...imgProps} />
        {topBadge}
      </span>
      <span className="gc-body">
        <span className="gc-name">{stretched ? <Link href={`/games/${game.id}`} className="gc-link" aria-label={ariaLabel}>{gameName(game)}</Link> : gameName(game)}</span>
        {store && <span className="result-store">{store}</span>}
        <OwnedChip steamAppid={game.steam_appid} />
        {/* 칸 높이는 CSS로 고정 — 값이 없어도 빈 칸을 남겨 같은 줄 카드의 제목·평가·칩·가격 위치가 맞는다 */}
        <span className="gc-info">
          {players && <span className="result-players">{players}</span>}
          {barrier && <span className="result-barrier">진입장벽 {barrier}</span>}
        </span>
        <span className="gc-rating" title={pct && game.review_total ? `Steam 리뷰 ${Number(game.review_total).toLocaleString('ko-KR')}개` : undefined}>
          {pct && (
            <>
              <span className="gc-rating-src">Steam</span>
              <span className="gc-rating-main">
                {summary && <span className={`gc-rating-grade is-${reviewTone(summary)}`}>{summary}</span>}
                <span className="gc-rating-pct num">{pct}%</span>
              </span>
            </>
          )}
        </span>
        {(hasGoty || demo || isTop10 || chips.length > 0) ? (
          <ChipRow
            items={[
              ...(demo ? [<span key="demo" className="chip is-static">무료 데모</span>] : []),
              ...(isTop10 ? [<span key="top10" className="chip is-static is-special">TOP 10</span>] : []),
              ...(hasGoty ? [<GotyBadge key="goty" awards={game.goty_awards} />] : []),
              ...chips.map((c) => <span key={c.text} className={`chip is-static${c.kind === 'tag' ? '' : ` is-${c.kind}`}`}>{c.text}</span>),
            ]}
            labels={[...(demo ? ['무료 데모'] : []), ...(isTop10 ? ['TOP 10'] : []), ...(hasGoty ? ['GOTY'] : []), ...chips.map((c) => c.text)]}
          />
        ) : <span className="gc-chips" aria-hidden="true" />}
        {children ?? (streamers.length > 0 && <StreamerBadge names={streamers} max={2} />)}
        <span className="gc-foot">
          <span className="result-price">
            {comingSoon ? (
              <span className="result-price-main"><span className="price-final no-discount">{comingSoonLabel(game)}</span></span>
            ) : game.is_free ? (
              <span className="result-price-main"><span className="price-final">무료</span></span>
            ) : PRICE_TYPE_LABEL[game.price_type] ? (
              <span className="result-price-main"><span className="price-final no-discount">{PRICE_TYPE_LABEL[game.price_type]}</span></span>
            ) : price ? (
              <>
                {price.discount > 0 && (
                  <span className="result-price-off">
                    <span className="discount-badge">-{price.discount}%</span>
                    <span className="price-original">{price.formattedOriginal}</span>
                    <SaleEnds endsAt={price.saleEndsAt} />
                  </span>
                )}
                <span className="result-price-main">
                  <span className="price-final">{price.formattedFinal}</span>
                  <LowestPriceBadge timing={getLowestTiming(game, price)} />
                </span>
              </>
            ) : null}
          </span>
          {compare && (
            <button
              type="button"
              className={`compare-btn${isPicked ? ' on' : ''}`}
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); compare.onToggle(); }}
              aria-pressed={isPicked}
              aria-label={`${gameName(game)} ${isPicked ? '비교에서 빼기' : '비교에 담기'}`}
              disabled={compare.disabled}
            >
              {isPicked ? '비교 중' : '+ 비교'}
            </button>
          )}
        </span>
      </span>
    </>
  );
  if (stretched) return <div className={`gc lift is-stretched${isPicked ? ' is-picked' : ''} ${className}`.trim()}>{body}</div>;
  return <Link href={`/games/${game.id}`} className={`gc lift${isPicked ? ' is-picked' : ''} ${className}`.trim()} aria-label={ariaLabel} onClick={onClick}>{body}</Link>;
}
