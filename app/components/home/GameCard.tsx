'use client';

// 메인 게임 카드 공통 컴포넌트 — 인원별 추천·찜 기반 추천·지금 뜨는 게임 1~3위·스트리머 협동이 같이 쓴다 (이번주의 게임 가로 카드는 따로)
// 위→아래: 이미지(순위 배지는 그 위) → 이름 → 인원·진입장벽 한 줄 → Steam 평가 한 줄 → 칩 줄(GOTY·태그 최대 2·크로스플레이·한국어 미지원, 한 줄 고정 — 넘치면 +N 칩) → 가격(카드 아래에 붙음, 역대 최저가 칩은 가격 줄 오른쪽 끝) → children(스트리머 배지 등 맨 아래 줄)
// 값이 없는 줄·칩은 숨긴다. 동접·소개문은 넣지 않는다. 게임 칸 모양은 목록(gameIndex)·카드 조회와 같은 느슨한 모양 + cardExtras(태그·평가·한국어)
import type { ReactNode } from 'react';
import Link from 'next/link';
import { getPriceInfo, getLowestTiming, PRICE_TYPE_LABEL } from '../../lib/price';
import { playersText } from '../../lib/players';
import { reviewTone } from '../../lib/review';
import { barrierLabel, infoChips } from '../../lib/cardInfo';
import LowestPriceBadge from '../LowestPriceBadge';
import SaleEnds from '../SaleEnds';
import GotyBadge from '../GotyBadge';
import GameImage, { type SteamSize } from '../GameImage';
import OwnedChip from '../owned/OwnedChip';
import ChipRow from './ChipRow';

// 스팀 외 스토어 이름 (games.source)
const STORE_NAME: Record<string, string> = { epic: 'Epic', battlenet: 'Battle.net', riot: 'Riot', ea: 'EA app', ubisoft: 'Ubisoft Connect', gog: 'GOG' };

type Props = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 게임 카드 칸은 목록(gameIndex)과 같은 느슨한 모양
  game: any;
  badge?: ReactNode;                                      // 이미지 위 왼쪽 위 (지금 뜨는 게임 순위 배지)
  image?: string | null;                                  // 기본은 cover → card 이미지
  imgProps?: { steamSize?: SteamSize; fallbackWidth?: number };
  eager?: boolean;
  ariaLabel?: string;
  className?: string;
  stretched?: boolean;                                    // 카드 안에 링크·버튼(스트리머 칩 등)이 있을 때 — 카드를 <a>로 감싸지 않고 이름 링크의 ::after가 카드 전체를 덮는다(a 안에 a 금지)
  children?: ReactNode;                                   // 가격 아래 추가 줄
};

export default function GameCard({ game, badge, image, imgProps = { steamSize: 'header' }, eager = false, ariaLabel, className = '', stretched = false, children }: Props) {
  const price = getPriceInfo(game);
  const players = playersText(game);
  const barrier = barrierLabel(game);
  const chips = infoChips(game);
  const hasGoty = Array.isArray(game.goty_awards) && game.goty_awards.length > 0;
  const store = game.steam_appid ? null : STORE_NAME[game.source] ?? '기타 스토어';
  const pct: number | null = game.review_percent || null;
  const summary: string | null = game.review_summary ?? null;
  const body = (
    <>
      <span className="gc-image">
        <GameImage src={image ?? (game.cover_image_url || game.card_image_url)} alt="" loading={eager ? 'eager' : 'lazy'} {...imgProps} />
        {badge}
      </span>
      <span className="gc-body">
        <span className="gc-name">{stretched ? <Link href={`/games/${game.id}`} className="gc-link" aria-label={ariaLabel}>{game.name}</Link> : game.name}</span>
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
        {(hasGoty || chips.length > 0) ? (
          <ChipRow
            items={[
              ...(hasGoty ? [<GotyBadge key="goty" awards={game.goty_awards} />] : []),
              ...chips.map((c) => <span key={c.text} className={`chip is-static${c.kind === 'tag' ? '' : ` is-${c.kind}`}`}>{c.text}</span>),
            ]}
            labels={[...(hasGoty ? ['GOTY'] : []), ...chips.map((c) => c.text)]}
          />
        ) : <span className="gc-chips" aria-hidden="true" />}
        <span className="gc-foot">
          <span className="result-price">
            {game.is_free ? (
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
        </span>
        {children}
      </span>
    </>
  );
  if (stretched) return <div className={`gc lift is-stretched ${className}`.trim()}>{body}</div>;
  return <Link href={`/games/${game.id}`} className={`gc lift ${className}`.trim()} aria-label={ariaLabel}>{body}</Link>;
}
