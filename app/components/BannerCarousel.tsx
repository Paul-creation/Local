'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getPriceInfo } from '../lib/price';

export default function BannerCarousel({ games }: { games: any[] }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (games.length <= 1) return;
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % games.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [games.length]);

  if (games.length === 0) return null;

  return (
    <div className="banner-carousel">
      {games.map((game, i) => {
        const price = getPriceInfo(game);
        return (
          <Link
            href={`/games/${game.id}`}
            key={game.id}
            className={`hero-card banner-slide ${i === index ? 'active' : ''}`}
          >
            <div className="hero-image-wrap">
              <img src={game.cover_image_url} alt={game.name} />
              <div className="hero-overlay" />
            </div>
            <div className="hero-content">
              <h2>{game.name}</h2>
              <div className="hero-meta">
                {game.min_players && game.max_players
                  ? `${game.min_players}-${game.max_players}인`
                  : ''}
                {game.difficulty ? ` · ${game.difficulty}` : ''}
              </div>
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
      <div className="banner-dots">
        {games.map((_, i) => (
          <button
            key={i}
            className={`banner-dot ${i === index ? 'active' : ''}`}
            onClick={() => setIndex(i)}
          />
        ))}
      </div>
    </div>
  );
}