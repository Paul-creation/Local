// 세로 표지 카드 — 메인 리디자인(인원별 추천·취향에 맞는 게임). 표지 위 왼쪽 위 배지 → 이름 → 인원·진입장벽 → 평가 → 할인 배지 + 가격
// 값이 없는 줄은 숨긴다 (지어내지 않음). 게임 칸 모양은 목록(gameIndex)·카드 조회와 같은 느슨한 모양
import Link from 'next/link';
import PosterImage from './PosterImage';
import { getPriceInfo, PRICE_TYPE_LABEL } from '../../../lib/price';
import { playersText } from '../../../lib/players';
import { barrierLabel } from '../../../lib/cardInfo';
import { gameName } from '../../../lib/gameName';
import { isComingSoon, comingSoonLabel } from '../../../lib/release';

export type PosterBadge = '요즘 뜨는 중' | '다시 뜨는 중' | '신작';
const BADGES: PosterBadge[] = ['요즘 뜨는 중', '다시 뜨는 중', '신작'];
// games.trend_badge 저장값 → 배지 글자 (app/lib/trending.ts BADGE_KEY와 같은 짝)
const TREND_LABEL: Record<string, PosterBadge> = { new: '신작', rising_old: '다시 뜨는 중', rising_recent: '요즘 뜨는 중' };

// badges: 서버가 준 배지 글자들(인원별 추천 recs.badges) — 정해진 세 가지 중 앞의 것 하나만 쓰고, 없으면 game.trend_badge
export const posterBadge = (game: Record<string, unknown>, badges?: string[]): PosterBadge | null =>
  BADGES.find((b) => badges?.includes(b)) ?? TREND_LABEL[game.trend_badge as string] ?? null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- 게임 카드 칸은 목록(gameIndex)과 같은 느슨한 모양
export default function PosterCard({ game, badge = null, eager = false, tourId }: { game: any; badge?: PosterBadge | null; eager?: boolean; tourId?: string }) {
  const price = getPriceInfo(game);
  const players = playersText(game);
  const barrier = barrierLabel(game);
  const pct: number | null = game.review_percent || null;
  const summary: string | null = game.review_summary ?? null;
  const cover = { vertical: game.cover_vertical_url ?? null, appid: game.steam_appid ?? null, wide: game.card_image_url || game.cover_image_url || null };
  const meta = [players, barrier ? `진입장벽 ${barrier}` : ''].filter(Boolean).join(' · ');
  return (
    <Link href={`/games/${game.id}`} className="mn-card" data-tour={tourId}>
      <span className="mn-poster">
        <PosterImage cover={cover} eager={eager} />
        {badge && <span className={`mn-badge ${badge === '신작' ? 'is-new' : 'is-trend'}`}>{badge}</span>}
      </span>
      <span className="mn-card-name">{gameName(game)}</span>
      {meta && <span className="mn-card-meta">{meta}</span>}
      {pct && <span className="mn-card-rating">{summary ? `${summary} ` : ''}{pct}%</span>}
      <span className="mn-card-price">
        {isComingSoon(game) ? (
          <span>{comingSoonLabel(game)}</span>
        ) : game.is_free ? (
          <span>무료</span>
        ) : PRICE_TYPE_LABEL[game.price_type] ? (
          <span>{PRICE_TYPE_LABEL[game.price_type]}</span>
        ) : price ? (
          <>
            {price.discount > 0 && <span className="mn-sale">-{price.discount}%</span>}
            <span>{price.formattedFinal}</span>
          </>
        ) : null}
      </span>
    </Link>
  );
}
