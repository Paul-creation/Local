'use client';

import Link from 'next/link';
import { getPriceInfo, getLowestTiming, PRICE_TYPE_LABEL } from '../../lib/price';
import LowestPriceBadge from '../LowestPriceBadge';
import SaleEnds from '../SaleEnds';
import type { TagTree } from '../../lib/tagTree';
import { playersText } from '../../lib/players';
import GameImage from '../GameImage';
import GameCard from '../home/GameCard';
import OwnedChip from '../owned/OwnedChip';
import { barrierLabel } from '../../lib/cardInfo';
import { gameName } from '../../lib/gameName';
import { isComingSoon, hasDemo, comingSoonLabel } from '../../lib/release';

// 스팀 외 스토어 이름 (games.source)
const STORE_NAME: Record<string, string> = { epic: 'Epic', battlenet: 'Battle.net', riot: 'Riot', ea: 'EA app', ubisoft: 'Ubisoft Connect', gog: 'GOG' };

// 검색 결과 카드 한 장 — 카드 보기는 메인과 같은 통일 카드(home/GameCard)로 그린다. 여기서 직접 그리는 건 행 보기와 compact뿐
// compare를 넘기면 가격 줄 오른쪽에 "+ 비교" 버튼이 붙는다 (검색 결과만)
// view="row": 한 줄 행 보기(검색 결과 전환용) — 썸네일·이름·인원·진입장벽·가격·+ 비교만, 태그 칩은 뺀다
// compact: 썸네일·타이틀·인원수·가격 줄만 (상세 "비슷한 게임"·"시리즈"·내 라이브러리) — 태그 칩은 뺀다 (스팀 외 스토어 이름은 유지)
export default function ResultCard({ game, tree, isTop10 = false, eager = false, onClick, compare, compact = false, view = 'card' }: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 게임 카드 칸은 목록(gameIndex)과 같은 느슨한 모양
  game: any;
  tree: TagTree | null;
  isTop10?: boolean;
  eager?: boolean;
  onClick?: () => void;
  compare?: { selected: boolean; disabled: boolean; onToggle: () => void };
  compact?: boolean;
  view?: 'card' | 'row';
}) {
  const price = getPriceInfo(game);
  const isSelected = !!compare?.selected;
  const players = playersText(game);
  const comingSoon = isComingSoon(game);
  const demo = hasDemo(game);
  // 스팀 외 스토어 게임은 스토어 이름을 작게
  const store = game.steam_appid ? null : STORE_NAME[game.source] ?? '기타 스토어';
  if (view === 'row') {
    const barrier = barrierLabel(game);
    return (
      <Link href={`/games/${game.id}`} className={`result-row lift${isSelected ? ' is-picked' : ''}`} onClick={onClick}>
        <span className="rr-thumb">
          <GameImage src={game.cover_image_url || game.card_image_url} steamSize="header" alt="" loading={eager ? 'eager' : 'lazy'} />
        </span>
        <span className="rr-main">
          <span className="rr-name">{gameName(game)}</span>
          {(store || players || barrier || demo) && (
            <span className="rr-info">
              {store && <span className="result-store">{store}</span>}
              {demo && <span className="chip is-static">무료 데모</span>}
              {players && <span className="result-players">{players}</span>}
              {barrier && <span className="result-barrier">진입장벽 {barrier}</span>}
            </span>
          )}
          <OwnedChip steamAppid={game.steam_appid} />
        </span>
        <span className="rr-price">
          {comingSoon ? (
            <span className="price-final no-discount">{comingSoonLabel(game)}</span>
          ) : game.is_free ? (
            <span className="price-final">무료</span>
          ) : PRICE_TYPE_LABEL[game.price_type] ? (
            <span className="price-final no-discount">{PRICE_TYPE_LABEL[game.price_type]}</span>
          ) : price ? (
            <>
              {price.discount > 0 && (
                <span className="rr-off">
                  <span className="discount-badge">-{price.discount}%</span>
                  <span className="price-original">{price.formattedOriginal}</span>
                </span>
              )}
              <span className="rr-final">
                <span className="price-final">{price.formattedFinal}</span>
                <LowestPriceBadge timing={getLowestTiming(game, price)} />
              </span>
              {price.discount > 0 && <SaleEnds endsAt={price.saleEndsAt} variant="row" />}
              {price.discount > 0 && <SaleEnds endsAt={price.saleEndsAt} variant="short" />}
            </>
          ) : null}
        </span>
        {compare && (
          <button
            type="button"
            className={`compare-btn${isSelected ? ' on' : ''}`}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); compare.onToggle(); }}
            aria-pressed={isSelected}
            aria-label={`${gameName(game)} ${isSelected ? '비교에서 빼기' : '비교에 담기'}`}
            disabled={compare.disabled}
          >
            {isSelected ? '비교 중' : '+ 비교'}
          </button>
        )}
      </Link>
    );
  }
  // 상세 "비슷한 게임"·"시리즈"·내 라이브러리의 작은 카드: 이미지·이름·인원·가격만
  if (compact) {
    return (
      <Link href={`/games/${game.id}`} className="result-card lift" onClick={onClick}>
        <span className="result-image">
          <GameImage src={game.cover_image_url || game.card_image_url} steamSize="header" alt="" loading={eager ? 'eager' : 'lazy'} />
        </span>
        <span className="result-body">
          <span className="result-title">{gameName(game)}</span>
          {store && <span className="result-store">{store}</span>}
          <OwnedChip steamAppid={game.steam_appid} />
          {players && <span className="result-players">{players}</span>}
          {demo && <span className="chip is-static">무료 데모</span>}
          <span className="result-foot">
            <span className="result-price">
              {comingSoon ? (
                <span className="price-final no-discount">{comingSoonLabel(game)}</span>
              ) : game.is_free ? (
                <span className="price-final">무료</span>
              ) : PRICE_TYPE_LABEL[game.price_type] ? (
                <span className="price-final no-discount">{PRICE_TYPE_LABEL[game.price_type]}</span>
              ) : price ? (
                <>
                  <LowestPriceBadge timing={getLowestTiming(game, price)} />
                  {price.discount > 0 && (
                    <span className="result-price-off">
                      <span className="discount-badge">-{price.discount}%</span>
                      <span className="price-original">{price.formattedOriginal}</span>
                      <SaleEnds endsAt={price.saleEndsAt} />
                    </span>
                  )}
                  <span className="price-final">{price.formattedFinal}</span>
                </>
              ) : null}
            </span>
          </span>
        </span>
      </Link>
    );
  }
  // 검색 결과 카드 보기 — 메인과 같은 통일 카드
  return <GameCard game={game} tree={tree} isTop10={isTop10} eager={eager} onClick={onClick} compare={compare} />;
}
