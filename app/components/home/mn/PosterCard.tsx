// 게임 카드(메인 공통) — 세로 표지 2:3(반경 4px, 안쪽 1px 테두리) 위 왼쪽 위 배지 → 이름(15px 굵게) → 정보 줄(13px: 인원·진입장벽, 평가) → 할인 배지 + 가격. 카드 전체가 링크
// compact: 포스터 + 게임명(한 줄)만 — 정보 줄·가격·배지를 그리지 않는다 ("N인 추천 게임"). hideMeta: 정보 줄(인원·진입장벽·평가)만 뺀다 (개인 추천)
// brackets: 마우스를 올리거나 키보드 포커스가 오면 표지에 선택 괄호가 바깥에서 안으로 들어온다 (.sb-group). 괄호는 한 화면에 하나만 — "N인 추천 게임" 카드에서만 켠다
// 값이 없는 줄은 숨긴다 (지어내지 않음). 게임 칸 모양은 목록(gameIndex)·카드 조회와 같은 느슨한 모양
import Link from 'next/link';
import PosterImage from './PosterImage';
import { BracketCorners } from '../../brand/SelectBrackets';
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
export default function PosterCard({ game, badge = null, eager = false, tourId, brackets = false, showOriginal = false, compact = false, hideMeta = false, saleOverlay = false }: { game: any; badge?: PosterBadge | null; eager?: boolean; tourId?: string; brackets?: boolean; showOriginal?: boolean; compact?: boolean; hideMeta?: boolean; saleOverlay?: boolean }) {
  const price = getPriceInfo(game);
  const players = playersText(game);
  const barrier = barrierLabel(game);
  const pct: number | null = game.review_percent || null;
  const summary: string | null = game.review_summary ?? null;
  const cover = { vertical: game.cover_vertical_url ?? null, appid: game.steam_appid ?? null, wide: game.card_image_url || game.cover_image_url || null };
  const meta = [players, barrier ? `진입장벽 ${barrier}` : ''].filter(Boolean).join(' · ');
  return (
    <Link href={`/games/${game.id}`} prefetch={false} className={`mn-card${brackets ? ' sb-group' : ''}${compact ? ' is-compact' : ''}`} data-tour={tourId}>
      <span className={`mn-poster${brackets ? ' sb-host' : ''}`}>
        <PosterImage cover={cover} eager={eager} />
        {badge && !compact && <span className={`mn-badge ${badge === '다시 뜨는 중' ? 'is-rise' : 'is-ink'}`}>{badge}</span>}
        {/* saleOverlay: 휴대폰 찜목록 — 포스터 왼쪽 위 초록 할인 배지 (데스크톱은 CSS로 숨김) */}
        {saleOverlay && price && price.discount > 0 && !game.is_free && <span className="mn-sale-ov">-{price.discount}%</span>}
        {brackets && <BracketCorners size="poster" hover />}
      </span>
      <span className="mn-card-name">{gameName(game)}</span>
      {!compact && !hideMeta && meta && <span className="mn-card-meta">{meta}</span>}
      {!compact && !hideMeta && pct && <span className="mn-card-rating">{summary ? `${summary} ` : ''}{pct}%</span>}
      {!compact && <span className="mn-card-price">
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
            {showOriginal && price.discount > 0 && <s className="mn-card-was">{price.formattedOriginal}</s>}
          </>
        ) : null}
      </span>}
    </Link>
  );
}
