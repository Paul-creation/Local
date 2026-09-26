'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getPriceInfo } from '../lib/price';
import { translateTag } from '../lib/tagTranslate';

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

  const game = games[index];
  const price = getPriceInfo(game);

  return (
    <div style={{ marginBottom: 32 }}>
      <Link href={`/games/${game.id}`} className="hero-card" style={{ marginBottom: 0 }}>
        <div className="hero-image-wrap">
          <img src={game.cover_image_url} alt={game.name} />
        </div>
        <div className="hero-content">
          <h2>{game.name}</h2>
          <div className="hero-meta">
            {game.min_players && game.max_players ? `${game.min_players}-${game.max_players}인` : ''}
            {game.difficulty ? ` · ${game.difficulty}` : ''}
          </div>
          {game.tags?.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {game.tags.slice(0, 4).map((tag: string) => (
                <span key={tag} className="category-tag">{translateTag(tag)}</span>
              ))}
            </div>
          )}
          {game.description && (
            <p style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.6, margin: 0 }}>
              {game.description.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#39;/g, "'").slice(0, 100)}...
            </p>
          )}
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

      {/* 점 네비게이션 */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 12 }}>
        {games.map((_, i) => (
          <button
            key={i}
            onClick={() => setIndex(i)}
            style={{
              width: i === index ? 22 : 6,
              height: 6,
              borderRadius: 3,
              background: i === index ? 'var(--accent)' : 'var(--border)',
              border: 'none', padding: 0, cursor: 'pointer',
              transition: 'all 0.25s ease',
            }}
          />
        ))}
      </div>
    </div>
  );
}