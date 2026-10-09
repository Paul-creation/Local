'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { SITE_URL } from '../../lib/site';
import { parseIdsParam, shareQuery } from '../../lib/wishlist';
import SaleEnds from '../SaleEnds';
import { getPriceInfo, getLowestTiming, PRICE_TYPE_LABEL } from '../../lib/price';
import LowestPriceBadge from '../LowestPriceBadge';
import { playersText } from '../../lib/players';
import { useGameIndex } from '../../lib/useGameIndex';
import GameImage from '../GameImage';
import PageSkeleton from '../status/PageSkeleton';
import WishlistButton from './WishlistButton';
import { useWishlist } from './useWishlist';

// 찜목록 페이지 — 내 목록(localStorage) 또는 공유 주소(?ids=)로 받은 목록을 읽기 전용으로 보여 준다
// 목록 카드는 검색 결과 카드(result-card)와 같은 모양, 판정은 넣지 않음. 없는 게임 id는 목록에서 빠진다
// 공유받은 목록은 "내 찜목록에 합치기"를 눌렀을 때만 저장
const STORE_NAME: Record<string, string> = { epic: 'Epic', battlenet: 'Battle.net', riot: 'Riot', ea: 'EA app', ubisoft: 'Ubisoft Connect', gog: 'GOG' };

// 카드에 쓰는 열만 적은 타입 (목록 API가 주는 게임 줄)
type Game = {
  id: string; name: string; source: string; steam_appid?: number | null; is_free?: boolean; price_type: string; lowest_price?: number | null;
  cover_image_url?: string | null; card_image_url?: string | null; min_players?: number | null; max_players?: number | null;
};

function Card({ game }: { game: Game }) {
  const price = getPriceInfo(game);
  const players = playersText(game);
  const store = game.steam_appid ? null : STORE_NAME[game.source] ?? '기타 스토어';
  return (
    <Link href={`/games/${game.id}`} className="result-card lift">
      <span className="result-image">
        <GameImage src={game.cover_image_url || game.card_image_url} steamSize="header" alt="" />
      </span>
      <span className="result-body">
        <span className="result-title">{game.name}</span>
        {store && <span className="result-store">{store}</span>}
        {players && <span className="result-players">{players}</span>}
        <span className="result-foot">
          <span className="result-price">
            {game.is_free ? (
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

export default function WishlistView() {
  const params = useSearchParams();
  const sharedParam = params.get('ids');
  const shared = sharedParam !== null; // ids가 있으면(비어 있어도) 공유 화면
  const sharedIds = useMemo(() => parseIdsParam(sharedParam), [sharedParam]);
  const mine = useWishlist();
  const index = useGameIndex();
  const [copied, setCopied] = useState(false);
  const [merged, setMerged] = useState(false);

  const ids = shared ? sharedIds : mine.ids;
  const games = useMemo(() => {
    if (!index.games) return [];
    const byId = new Map((index.games as Game[]).map((g) => [g.id, g]));
    return ids.map((id) => byId.get(id)).filter((g): g is Game => !!g); // 없는 id는 무시
  }, [index.games, ids]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(SITE_URL + shareQuery(mine.ids));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };
  const mergeIntoMine = () => { mine.merge(games.map((g) => g.id)); setMerged(true); };

  const waiting = !index.games || (!shared && !mine.ready);
  const empty = !waiting && games.length === 0;

  return (
    <>
      <div className="wishlist-head">
        <h1 className="wishlist-title">{shared ? '공유받은 찜목록' : '찜목록'}</h1>
        <div className="wishlist-actions">
          {shared ? (
            <>
              <button type="button" className="btn btn-primary" onClick={mergeIntoMine} disabled={merged || games.length === 0}>
                {merged ? '합쳤어요' : '내 찜목록에 합치기'}
              </button>
              <Link href="/wishlist" className="btn btn-outline">내 찜목록 보기</Link>
            </>
          ) : (
            mine.ids.length > 0 && (
              <button type="button" className="btn btn-outline" onClick={copyLink} data-copied={copied || undefined}>
                {copied ? '링크 복사됨' : '공유 링크 복사'}
              </button>
            )
          )}
        </div>
      </div>

      {shared && <p className="wishlist-notice">링크로 받은 목록이에요. 합치기를 누르기 전에는 내 찜목록에 저장되지 않아요.</p>}

      {waiting && (index.error ? (
        <div className="results-empty">
          <p className="results-empty-title">게임 목록을 불러오지 못했어요</p>
          <div className="results-empty-actions">
            <button type="button" onClick={index.retry} className="btn btn-outline">다시 시도</button>
          </div>
        </div>
      ) : <PageSkeleton />)}

      {empty && (
        <p className="wishlist-empty">
          {shared ? '공유받은 목록에서 찾을 수 있는 게임이 없어요.' : '아직 찜한 게임이 없어요. 게임 상세 페이지나 비교 페이지에서 “찜목록에 담기”를 눌러 보세요.'}
        </p>
      )}

      {!waiting && games.length > 0 && (
        <div className="result-grid">
          {games.map((g) => (
            <div key={g.id} className="wishlist-item">
              <Card game={g} />
              {!shared && <WishlistButton gameId={g.id} />}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
