// 담당: Paul(메인 배너·디자인)
'use client';

import Link from 'next/link';
import BannerCarousel from '../BannerCarousel';
import { getPriceInfo } from '../../lib/price';

export default function HomeSections({ games }: { games: any[] }) {
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
                    {featured && (
            <Link href={`/games/${featured.id}`} className="hero-card">
              <div className="hero-image-wrap">
                <img src={(featured.card_image_url || featured.cover_image_url)} alt="" aria-hidden="true" className="img-backdrop" />
                <img src={(featured.card_image_url || featured.cover_image_url)} alt={featured.name} />
              </div>
              <div className="hero-content">
                <span className="hero-badge">🔥 이번주의 게임</span>
                <h2>{featured.name}</h2>
                <p className="hero-tagline">이번주에 가장 인기있던 작품, 친구들하고 어때요?</p>
                <div className="hero-meta">
                  {featured.min_players && featured.max_players ? `${featured.min_players}-${featured.max_players}인` : ''}
                  {featured.difficulty ? ` · ${featured.difficulty}` : ''}
                </div>
                {featured.tags?.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {featured.tags.slice(0, 4).map((tag: string) => (
                      <span key={tag} className="category-tag">{tag}</span>
                    ))}
                  </div>
                )}
                {featured.fun_description ? (
  <p style={{ fontSize: 16, color: 'var(--text)', fontWeight: 600, lineHeight: 1.6, margin: 0 }}>{featured.fun_description}</p>
) : featured.description && (
  <p style={{ fontSize: 15, color: 'var(--text-dim)', lineHeight: 1.6, margin: 0 }}>
    {featured.description.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#39;/g, "'").slice(0, 120)}...
  </p>
)}
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

          {bannerPool.length > 0 && (
            <>
              <div className="section-label">🎯 추천 게임</div>
              <BannerCarousel games={bannerPool} />
            </>
          )}



          {freeGames.length > 0 && (
            <section id="free" className="free-section">
              <div className="section-header">
                <h2 className="section-title">🆓 지금 무료로 즐길 수 있는 게임</h2>
                <span className="section-sub">설치만 하면 바로 친구랑 시작 가능</span>
              </div>
              <div className="free-strip">
                {freeGames.map((g) => (
                  <a href={`/games/${g.id}`} key={g.id} className="free-chip">
                    <img src={g.cover_image_url} alt={g.name} />
                    <span>{g.name}</span>
                  </a>
                ))}
              </div>
            </section>
          )}

          {hotGames.length > 0 && (
            <div style={{ marginBottom: 32 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 16 }}>인기 급상승</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                {hotGames.map((game, i) => (
                  <Link href={`/games/${game.id}`} key={game.id} style={{ textDecoration: 'none' }}>
                   <div style={{
  display: 'flex', alignItems: 'center', gap: 16,
  background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)',
  padding: '18px 20px', border: '1px solid var(--border-light)',
  boxShadow: '0 2px 8px rgba(0,0,0,0.10)',
}}>
                      <span style={{ fontSize: 24, fontWeight: 900, color: 'var(--text-dimmer)', width: 32, flexShrink: 0, textAlign: 'center' }}>
    {i + 1}
  </span>
  <img src={game.cover_image_url} alt={game.name} style={{ width: 96, aspectRatio: '460 / 215', objectFit: 'cover', borderRadius: 8, flexShrink: 0 }} />
  <div style={{ minWidth: 0 }}>
    <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{game.name}</div>
    <div style={{ fontSize: 15, color: 'var(--text-dimmer)' }}>
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

        </>
  );
}
