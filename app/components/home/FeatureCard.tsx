// 담당: Paul(메인 배너·디자인)
// 메인 "이번주의 게임"·"추천 게임" 카드 — 위: 스팀 헤더 비율(460:215) 이미지가 카드 폭에 꽉 차게, 아래: 라벨·제목·한 줄 소개·뱃지·가격
import Link from 'next/link';
import { getPriceInfo } from '../../lib/price';
import SaleEnds from '../SaleEnds';
import { playersText } from '../../lib/players';
import { badgeClass } from '../../lib/badge.mjs';
import GameImage from '../GameImage';
import GotyBadge from '../GotyBadge';
import OwnedChip from '../owned/OwnedChip';

const decode = (s: string) => s.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#39;/g, "'");

export default function FeatureCard({ game, label, sub, priority = false }: { game: any; label?: string; sub?: string | null; priority?: boolean }) {
  const price = getPriceInfo(game);
  const image = game.cover_image_url || game.card_image_url;
  const intro = game.fun_description || (game.description ? `${decode(game.description).slice(0, 90)}…` : '');
  const players = playersText(game);
  return (
    <Link href={`/games/${game.id}`} className="feature-card lift">
      <span className="feature-image">
        <GameImage src={image} fallbackWidth={920} alt={game.name} fetchPriority={priority ? 'high' : undefined} loading={priority ? undefined : 'lazy'} />
      </span>
      <span className="feature-body">
        {label && (
          <span className="feature-label">
            {label}
            {sub && <span className="feature-sub">{sub}</span>}
          </span>
        )}
        <span className="feature-title">{game.name}</span>
        {intro && <span className="feature-intro">{intro}</span>}
        <span className="feature-badges">
          <OwnedChip steamAppid={game.steam_appid} />
          <GotyBadge awards={game.goty_awards} />
          {game.category && <span className={`badge-neutral ${badgeClass(game.category)}`}>{game.category}</span>}
          {players && <span className="badge">{players}</span>}
        </span>
        <span className="feature-price">
          {game.is_free ? (
            <span className="price-final">무료</span>
          ) : price ? (
            <>
              {price.discount > 0 && <span className="discount-badge">-{price.discount}%</span>}
              {price.discount > 0 && <span className="price-original">{price.formattedOriginal}</span>}
              {price.discount > 0 && <SaleEnds endsAt={price.saleEndsAt} />}
              <span className="price-final">{price.formattedFinal}</span>
            </>
          ) : null}
        </span>
      </span>
    </Link>
  );
}
