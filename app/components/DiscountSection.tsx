'use client';

import { useState } from 'react';
import Link from 'next/link';

function getLatestDiscount(priceHistory: any[]) {
  if (!priceHistory?.length) return null;
  const sorted = [...priceHistory].sort(
    (a, b) => new Date(b.checked_at).getTime() - new Date(a.checked_at).getTime()
  );
  const latest = sorted[0];
  if (!latest.discount_percent || latest.discount_percent === 0) return null;
  const original = sorted.find((p) => p.discount_percent === 0)?.price || latest.price;
  return {
    discount: latest.discount_percent,
    finalPrice: latest.price,
    originalPrice: original,
  };
}

export default function DiscountSection({ games }: { games: any[] }) {
  const [current, setCurrent] = useState(0);
  const discounted = games
    .map((g) => ({ ...g, deal: getLatestDiscount(g.price_history) }))
    .filter((g) => g.deal !== null)
    .slice(0, 8);

  if (discounted.length === 0) return null;

  const fmt = (n: number) => {
  if (n === 0) return '무료';
  return `$${n.toFixed(2)}`;
};

  return (
    <section className="discount-section">
      <div className="section-header">
        <h2 className="section-title">🔥 지금 할인 중</h2>
        <span className="section-sub">할인 끝나기 전에 확인해봐</span>
      </div>
      <div className="discount-strip">
        {discounted.map((g) => (
          <Link href={`/games/${g.id}`} key={g.id} className="discount-card">
            <div className="discount-card-img">
              <img src={g.cover_image_url} alt={g.name} />
              <span className="discount-card-badge">-{g.deal.discount}%</span>
            </div>
            <div className="discount-card-body">
              <p className="discount-card-name">{g.name}</p>
              <div className="discount-card-price">
                <span className="discount-card-original">
                  {fmt(g.deal.originalPrice)}
                </span>
                <span className="discount-card-final">
                  {fmt(g.deal.finalPrice)}
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}