// 담당: Paul(메인 배너·디자인)
'use client';

import Link from 'next/link';
import BannerCarousel from '../BannerCarousel';
import HotChart from './HotChart';
import type { HotTab } from '../../lib/hotChart';
import { getPriceInfo } from '../../lib/price';

export default function HomeSections({ games, hotTabs, weekly }: { games: any[]; hotTabs: HotTab[]; weekly?: any }) {
  // featured_games에서 뽑힌 이번 주 게임, 기록이 없으면 예전처럼 featured 칸
  const featured = weekly || games.find((g) => g.featured);
  const bannerPool = games.filter((g) => g.is_casual_party && !g.featured && g.id !== featured?.id);

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
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="hero-badge">🔥 이번주의 게임</span>
                  {featured.weekLabel && <span style={{ fontSize: 12, color: 'var(--text-dimmer)' }}>{featured.weekLabel}</span>}
                </div>
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



          {/* 🔥 지금 뜨는 게임 — 데이터는 page.tsx에서 따로 가져옴 (lib/hotChart) */}
          {hotTabs.length > 0 && <HotChart tabs={hotTabs} />}

        </>
  );
}
