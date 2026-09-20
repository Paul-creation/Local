'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function FeaturedCarousel({ games }: { games: any[] }) {
  const [index, setIndex] = useState(0);
  const visibleCount = 4;

  useEffect(() => {
    if (games.length <= visibleCount) return;
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % games.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [games.length]);

  if (games.length === 0) return null;

  const visible = Array.from(
    { length: Math.min(visibleCount, games.length) },
    (_, i) => games[(index + i) % games.length]
  );

  return (
    <section className="carousel-section">
      <div className="carousel-header">
        <h2>인기 게임</h2>
        {games.length > visibleCount && (
          <div className="carousel-controls">
            <button onClick={() => setIndex((i) => (i - 1 + games.length) % games.length)}>‹</button>
            <button onClick={() => setIndex((i) => (i + 1) % games.length)}>›</button>
          </div>
        )}
      </div>
      <div className="carousel-track" key={index}>
        {visible.map((game) => (
          <Link href={`/games/${game.id}`} key={game.id} className="carousel-card">
            <div className="carousel-image-wrap">
              <img src={game.cover_image_url} alt={game.name} />
            </div>
            <div className="carousel-card-body">
              <span className="carousel-card-name">{game.name}</span>
              {game.category && <span className="category-tag">{game.category}</span>}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}