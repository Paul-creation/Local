'use client';

import Link from 'next/link';
import BannerCarousel from './BannerCarousel';
import DiscountSection from './DiscountSection';
import AIRecommend from './AIRecommend';
import { getPriceInfo } from '../lib/price';

export default function HomeHero({ games }: { games: any[] }) {
  const featured = games.find((g) => g.featured);
  const bannerPool = games.filter((g) => g.is_casual_party && !g.featured);
  const freeGames = games.filter((g) => g.is_free);
  const hotGames = [...games]
    .filter(g => g.heat_rank)
    .sort((a, b) => a.heat_rank - b.heat_rank)
    .slice(0, 6);
  const featuredPrice = featured ? getPriceInfo(featured) : null;

  return (
    <>
      {/* 검색 + AI 추천 */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 28 }}>
        <input
          type="text"
          placeholder="게임 이름으로 검색..."
          onClick={() => window.location.href = '/browse'}
          style={{
            flex: 1, height: 48, padding: '0 18px',
            border: '1.5px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-card)',
            fontSize: 15, color: 'var(--text)',
            outline: 'none', cursor: 'pointer',
          }}
          readOnly
        />
        <AIRecommend />
      </div>

      {/* 히어로 */}
      {featured && (
        <Link href={`/games/${featured.id}`} className="hero-card" style={{ marginBottom: 32 }}>
          <div className="hero-image-wrap">
            <img src={featured.cover_image_url} alt={featured.name} />
            <div className="hero-overlay" />
          </div>
          <div className="hero-content">
            <span className="hero-badge">🔥 이번주의 게임</span>
            <h2>{featured.name}</h2>
            <p className="hero-tagline">이번주에 가장 인기있던 작품, 친구들하고 어때요?</p>
            <div className="hero-meta">
              {featured.min_players && featured.max_players ? `${featured.min_players}-${featured.max_players}인` : ''}
              {featured.difficulty ? ` · ${featured.difficulty}` : ''}
            </div>
            {featuredPrice && (
              <div className="price-row">
                {featuredPrice.discount > 0 && (
                  <>
                    <span className="discount-badge">-{featuredPrice.discount}%</span>
                    <span className="price-original">{featuredPrice.formattedOriginal}</span>
                  </>
                )}
                <span className="price-final">{featuredPrice.formattedFinal}</span>
              </div>
            )}
          </div>
        </Link>
      )}

      {/* 추천 게임 */}
      {bannerPool.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <div className="section-label">🎯 추천 게임</div>
          <BannerCarousel games={bannerPool} />
        </div>
      )}

      {/* 지금 할인 중 */}
      <div style={{ marginBottom: 32 }}>
        <DiscountSection games={games} />
      </div>

      {/* 인기 급상승 */}
      {hotGames.length > 0 && (
        <div style={{ marginBottom: 40 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>인기 급상승</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
            {hotGames.map((game, i) => (
              <Link href={`/games/${game.id}`} key={game.id} style={{ textDecoration: 'none' }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)',
                  padding: '14px 16px', border: '1px solid var(--border-light)',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.10)',
                }}>
                  <span style={{ fontSize: 20, fontWeight: 900, color: 'var(--text-dimmer)', width: 28, flexShrink: 0, textAlign: 'center' }}>
                    {i + 1}
                  </span>
                  <img src={game.cover_image_url} alt={game.name} style={{ width: 64, height: 36, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>
                      {game.name}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-dimmer)' }}>
                      {game.min_players && game.max_players ? `${game.min_players}-${game.max_players}인` : ''}
                      {game.difficulty ? ` · ${game.difficulty}` : ''}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* 무료 게임 */}
      {freeGames.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 12 }}>지금 무료로 즐길 수 있는 게임</h2>
          <div className="free-strip">
            {freeGames.map((g) => (
              <a href={`/games/${g.id}`} key={g.id} className="free-chip">
                <img src={g.cover_image_url} alt={g.name} />
                <span>{g.name}</span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* 전체 게임 탐색 버튼 */}
      <button
        onClick={() => window.location.href = '/browse'}
        style={{
          width: '100%', padding: '20px',
          background: 'var(--accent)',
          border: 'none',
          borderRadius: 'var(--radius-lg)',
          fontSize: 16, fontWeight: 800,
          color: '#fff', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          marginBottom: 32,
          boxShadow: '0 4px 16px rgba(0,113,227,0.3)',
        }}
      >
        전체 게임 탐색하기 →
      </button>
    </>
  );
}