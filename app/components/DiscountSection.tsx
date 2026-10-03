'use client';

import Link from 'next/link';
import { getPriceInfo, getLowestTiming } from '../lib/price';
import LowestPriceBadge from './LowestPriceBadge';
import { playersText } from '../lib/players';

export default function DiscountSection({ games }: { games: any[] }) {
  const discounted = games
    .filter((g) => {
      const price = getPriceInfo(g);
      return price && price.discount > 0;
    })
  if (discounted.length === 0) return null;

  return (
    <section id="discount" className="discount-section">
      <div className="section-header">
        <h2 className="section-title">🔥 지금 할인 중</h2>
        <span className="section-sub">할인 끝나기 전에 확인해봐</span>
      </div>
      <div className="grid">
        {discounted.map((game) => {
          const price = getPriceInfo(game);
          return (
            <Link href={`/games/${game.id}`} key={game.id} className="card">
                            <div className="card-image-wrap">
                <img src={(game.card_image_url || game.cover_image_url)} alt={game.name} />
                <span className="platform-badge">{game.steam_appid ? 'Steam' : (({ epic: 'Epic', battlenet: 'Battle.net', riot: 'Riot' } as Record<string, string>)[game.source] ?? 'PC') /* STORE_BADGE */}</span>
                <LowestPriceBadge timing={getLowestTiming(game, price)} overlay />
              </div>
              <div className="card-body">
                <h3>{game.name}</h3>
                <p className="card-meta">
                  {playersText(game)}
                  {game.difficulty ? ` · ${game.difficulty}` : ''}
                </p>
                {game.tags?.slice(0, 3).map((tag: string) => (
                  <span key={tag} className="category-tag">{tag}</span>
                ))}
                {price && (
                  <div className="price-row">
                    {price.discount > 0 && (
                      <>
                        <span className="discount-badge">-{price.discount}%</span>
                        <span className="price-original">{price.formattedOriginal}</span>
                      </>
                    )}
                    <span className="price-final">{price.formattedFinal}</span>
                  </div>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}