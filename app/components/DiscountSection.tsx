'use client';

import Link from 'next/link';
import { getPriceInfo } from '../lib/price';

export default function DiscountSection({ games }: { games: any[] }) {
  const discounted = games
    .filter((g) => {
      const price = getPriceInfo(g);
      return price && price.discount > 0;
    })
    .slice(0, 8);

  if (discounted.length === 0) return null;

  return (
    <section className="discount-section">
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
                <img src={game.cover_image_url} alt={game.name} />
                {game.steam_appid && <span className="platform-badge">Steam</span>}
                {(() => {
                  if (!price || price.discount === 0 || !game.lowest_price || game.is_free) return null;
                  if (price.final < 100 || game.lowest_price < 100) return null;
                  const ratio = price.final / game.lowest_price;
                  if (ratio <= 1.05) return <span className="timing-badge best">🔥 역대 최저가</span>;
                  if (ratio <= 1.15) return <span className="timing-badge near">💰 최저가 근접</span>;
                  return null;
                })()}
              </div>
              <div className="card-body">
                <h3>{game.name}</h3>
                <p className="card-meta">
                  {game.min_players && game.max_players ? `${game.min_players}-${game.max_players}인` : ''}
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