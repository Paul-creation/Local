'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { SITE_URL } from '../../lib/site';
import { parseIdsParam, shareQuery } from '../../lib/wishlist';
import { useGameIndex } from '../../lib/useGameIndex';
import GameCard from '../home/GameCard';
import Loader from '../status/Loader';
import WishlistButton from './WishlistButton';
import { useWishlist } from './useWishlist';

// 찜목록 페이지 — 내 목록(localStorage) 또는 공유 주소(?ids=)로 받은 목록을 읽기 전용으로 보여 준다
// 목록 카드는 검색 결과·메인과 같은 통일 카드(GameCard), 판정은 넣지 않음. 없는 게임 id는 목록에서 빠진다
// 공유받은 목록은 "내 찜목록에 합치기"를 눌렀을 때만 저장

// 목록 API가 주는 게임 줄(카드 칸은 느슨한 모양)
type Game = { id: string; [key: string]: unknown };

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
      ) : <Loader />)}

      {empty && (
        <p className="wishlist-empty">
          {shared ? '공유받은 목록에서 찾을 수 있는 게임이 없어요.' : '아직 찜한 게임이 없어요. 게임 상세 페이지나 비교 페이지에서 “찜목록에 담기”를 눌러 보세요.'}
        </p>
      )}

      {!waiting && games.length > 0 && (
        <div className="result-grid">
          {games.map((g) => (
            <div key={g.id} className="wishlist-item">
              <GameCard game={g} tree={index.tree} />
              {!shared && <WishlistButton gameId={g.id} />}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
