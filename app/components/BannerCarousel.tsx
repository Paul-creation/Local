'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getPriceInfo } from '../lib/price';
import { translateTag } from '../lib/tagTranslate';
import { playersText } from '../lib/players';
import { sizedImage } from '../lib/imageUrl';

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
          <img src={sizedImage(game.card_image_url || game.cover_image_url, 1280)} alt="" aria-hidden="true" className="img-backdrop" />
          <img src={sizedImage(game.card_image_url || game.cover_image_url, 1280)} alt={game.name} />
        </div>
        <div className="hero-content">
          <h2>{game.name}</h2>
          <div className="hero-meta">
            {playersText(game)}
            {game.difficulty ? ` · ${game.difficulty}` : ''}
          </div>
          {game.tags?.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {game.tags.slice(0, 4).map((tag: string) => (
                <span key={tag} className="category-tag">{translateTag(tag)}</span>
              ))}
            </div>
          )}
          {game.fun_description ? (
  <p style={{ fontSize: 16, color: 'var(--text)', fontWeight: 600, lineHeight: 1.6, margin: 0 }}>{game.fun_description}</p>
) : game.description && (
            <p style={{ fontSize: 15, color: 'var(--text-dim)', lineHeight: 1.6, margin: 0 }}>
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
      {/* 보이는 점은 작게, 누르는 영역은 28px 높이로 넉넉하게 */}
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 4 }}>
        {games.map((_, i) => (
          <button
            key={i}
            onClick={() => setIndex(i)}
            aria-label={`${i + 1}번째 추천 게임`}
            aria-current={i === index}
            style={{ minWidth: 24, height: 28, padding: '0 4px', border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <span style={{
              display: 'block',
              width: i === index ? 22 : 6,
              height: 6,
              borderRadius: 3,
              background: i === index ? 'var(--accent)' : 'var(--border)',
              transition: 'all 0.25s ease',
            }} />
          </button>
        ))}
      </div>
    </div>
  );
}