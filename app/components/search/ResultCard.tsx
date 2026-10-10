'use client';

import Link from 'next/link';
import { getPriceInfo, getLowestTiming, PRICE_TYPE_LABEL } from '../../lib/price';
import LowestPriceBadge from '../LowestPriceBadge';
import SaleEnds from '../SaleEnds';
import { cardChips } from '../../lib/tagGroups';
import type { TagTree } from '../../lib/tagTree';
import { playersText } from '../../lib/players';
import GameImage from '../GameImage';
import OwnedChip from '../owned/OwnedChip';
import { barrierLabel } from '../../lib/cardInfo';

// 스팀 외 스토어 이름 (games.source)
const STORE_NAME: Record<string, string> = { epic: 'Epic', battlenet: 'Battle.net', riot: 'Riot', ea: 'EA app', ubisoft: 'Ubisoft Connect', gog: 'GOG' };

// 검색 결과 카드 한 장 — 검색 결과와 상세 페이지의 "비슷한 게임"이 같이 쓴다
// compare를 넘기면 카드 아래에 "+ 비교" 버튼이 붙는다 (검색 결과만)
// view="row": 한 줄 행 보기(검색 결과 전환용) — 썸네일·이름·인원·진입장벽·가격·+ 비교만, 태그 칩은 뺀다
// compact: 썸네일·타이틀·인원수·가격 줄만 (홈 추천·상세 "비슷한 게임") — 태그 칩은 뺀다 (스팀 외 스토어 이름은 유지)
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
  const chips = compact ? [] : cardChips(tree, game, isTop10);
  const players = playersText(game);
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
          <span className="rr-name">{game.name}</span>
          {(store || players || barrier) && (
            <span className="rr-info">
              {store && <span className="result-store">{store}</span>}
              {players && <span className="result-players">{players}</span>}
              {barrier && <span className="result-barrier">진입장벽 {barrier}</span>}
            </span>
          )}
          <OwnedChip steamAppid={game.steam_appid} />
        </span>
        <span className="rr-price">
          {game.is_free ? (
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
            aria-label={`${game.name} ${isSelected ? '비교에서 빼기' : '비교에 담기'}`}
            disabled={compare.disabled}
          >
            {isSelected ? '비교 중' : '+ 비교'}
          </button>
        )}
      </Link>
    );
  }
  return (
    <Link href={`/games/${game.id}`} className={`result-card lift${isSelected ? ' is-picked' : ''}`} onClick={onClick}>
      <span className="result-image">
        <GameImage src={game.cover_image_url || game.card_image_url} steamSize="header" alt="" loading={eager ? 'eager' : 'lazy'} />
      </span>
      <span className="result-body">
        <span className="result-title">
          {game.name}
        </span>
        {store && <span className="result-store">{store}</span>}
        <OwnedChip steamAppid={game.steam_appid} />
        {chips.length > 0 && <span className="result-meta">{chips.map((c) => <span key={c.text} className={`hc-tag${c.kind === 'special' ? ' tag-special' : ''}`}>{c.text}</span>)}</span>}
        {players && <span className="result-players">{players}</span>}
        <span className="result-foot">
          <span className="result-price">
            {game.is_free ? (
              <span className="price-final">무료</span>
            ) : PRICE_TYPE_LABEL[game.price_type] ? (
              // 월 구독·판매처에서 확인 게임은 예전 가격 대신 문구 (가격 슬라이더·할인 필터에서는 가격 없음으로 빠짐)
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
          {/* COMPARE_V2 — 비교 담기를 넘긴 곳(검색 결과)에서만 */}
          {compare && (
            <button
              type="button"
              className={`compare-btn${isSelected ? ' on' : ''}`}
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); compare.onToggle(); }}
              aria-pressed={isSelected}
              aria-label={`${game.name} ${isSelected ? '비교에서 빼기' : '비교에 담기'}`}
              disabled={compare.disabled}
            >
              {isSelected ? '비교 중' : '+ 비교'}
            </button>
          )}
        </span>
      </span>
    </Link>
  );
}
