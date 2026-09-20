'use client';

import Link from 'next/link';
import { useState } from 'react';
import FeaturedCarousel from './FeaturedCarousel';

const CATEGORIES = ['전체', '파티', '협동', '퍼즐', '서바이벌'];

export default function GameGrid({ games }: { games: any[] }) {
  const [category, setCategory] = useState('전체');

  const featured = games.find((g) => g.featured);
  const rest = games.filter((g) => !g.featured);
  const filtered = category === '전체' ? rest : rest.filter((g) => g.category === category);

  return (
    <>
      {featured && (
        <Link href={`/games/${featured.id}`} className="hero-card">
          <div className="hero-image-wrap">
            <img src={featured.cover_image_url} alt={featured.name} />
            <div className="hero-overlay" />
          </div>
          <div className="hero-content">
            <span className="hero-badge">🔥 이번주의 게임</span>
            <h2>{featured.name}</h2>
            <p className="hero-tagline">이번주에 가장 인기있던 작품, 친구들하고 어때요?</p>
            <div className="hero-meta">
              {featured.min_players && featured.max_players
                ? `${featured.min_players}-${featured.max_players}인`
                : ''}
              {featured.difficulty ? ` · ${featured.difficulty}` : ''}
            </div>
          </div>
        </Link>
      )}

      <FeaturedCarousel games={rest} />

      <div className="category-pills">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            className={`pill ${category === c ? 'pill-active' : ''}`}
            onClick={() => setCategory(c)}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="grid">
        {filtered.map((game) => (
          <Link href={`/games/${game.id}`} key={game.id} className="card">
            <div className="card-image-wrap">
              <img src={game.cover_image_url} alt={game.name} />
              {game.platform?.[0] && <span className="platform-badge">{game.platform[0]}</span>}
            </div>
            <div className="card-body">
              <h3>{game.name}</h3>
              <p className="card-meta">
                {game.min_players && game.max_players ? `${game.min_players}-${game.max_players}인` : ''}
                {game.difficulty ? ` · ${game.difficulty}` : ''}
              </p>
              {game.category && <span className="category-tag">{game.category}</span>}
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}