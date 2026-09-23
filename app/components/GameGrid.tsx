'use client';

import Link from 'next/link';
import { useState } from 'react';
import BannerCarousel from './BannerCarousel';
import AIRecommend from './AIRecommend';
import { getPriceInfo } from '../lib/price';
import { TAG_GROUPS } from '../lib/tagGroups';

const CATEGORIES = ['전체', '파티', '협동', '퍼즐', '서바이벌'];
const GROUP_COLORS = ['#e6742e', '#0f9b8e', '#5b6ef5', '#c0392b', '#9b59b6', '#d4a017'];

export default function GameGrid({ games }: { games: any[] }) {
  const [category, setCategory] = useState('전체');
  const [browseOpen, setBrowseOpen] = useState(false);
  const [allTagsOpen, setAllTagsOpen] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [query, setQuery] = useState('');

  const featured = games.find((g) => g.featured);

  // 메인 그리드는 항상 전체 라이브러리
  const pool = games;

  const presentTags = new Set(pool.flatMap((g) => g.tags || []));
  const groupedTags = Object.entries(TAG_GROUPS)
    .map(([group, tags]) => [group, tags.filter((t) => presentTags.has(t))] as [string, string[]])
    .filter(([, tags]) => tags.length > 0);

  const knownTags = new Set(Object.values(TAG_GROUPS).flat());
  const ungroupedInGroups = Array.from(presentTags).filter((t) => !knownTags.has(t));
  if (ungroupedInGroups.length > 0) groupedTags.push(['기타', ungroupedInGroups]);

  const allTagsSorted = Array.from(presentTags).sort((a, b) => a.localeCompare(b, 'ko'));

  const toggleTag = (tag: string) =>
    setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));

  const normalizedQuery = query.trim().toLowerCase();

  const filtered = pool.filter((g) => {
    const categoryMatch = category === '전체' || g.category === category;
    const tagMatch = selectedTags.length === 0 || selectedTags.some((t) => g.tags?.includes(t));
    const queryMatch =
      normalizedQuery === '' ||
      g.name.toLowerCase().includes(normalizedQuery) ||
      g.tags?.some((t: string) => t.toLowerCase().includes(normalizedQuery));
    return categoryMatch && tagMatch && queryMatch;
  });

  const featuredPrice = featured ? getPriceInfo(featured) : null;
  const bannerPool = games.filter((g) => g.is_casual_party && !g.featured);

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

      {bannerPool.length > 0 && (
        <>
          <div className="section-label">🎯 추천 게임</div>
          <BannerCarousel games={bannerPool} />
        </>
      )}

      <div className="search-row">
              <div className="search-row">
        <div className="search-bar-clean">
          <input
            type="text"
            placeholder="게임 이름 또는 태그로 검색"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && <button className="search-clear" onClick={() => setQuery('')}>✕</button>}
        </div>
        <AIRecommend />
      </div>

      <div className="category-pills">
        {CATEGORIES.map((c) => (
          <button key={c} className={`pill ${category === c ? 'pill-active' : ''}`} onClick={() => setCategory(c)}>
            {c}
          </button>
        ))}
        <button className={`pill ${browseOpen ? 'pill-active' : ''}`} onClick={() => setBrowseOpen((v) => !v)}>
          태그로 찾기 {browseOpen ? '▴' : '▾'}
        </button>
        {selectedTags.length > 0 && (
          <span style={{ color: 'var(--text-dimmer)', fontSize: 13, alignSelf: 'center' }}>
            {selectedTags.length}개 선택됨
          </span>
        )}
      </div>

      {browseOpen && (
        <div className="browse-panel">
          <div className="browse-groups">
            {groupedTags.map(([group, tags], i) => (
              <div
                className="browse-group-card"
                key={group}
                style={{ '--group-color': GROUP_COLORS[i % GROUP_COLORS.length] } as React.CSSProperties}
              >
                <div className="browse-group-title">{group}</div>
                <div className="browse-group-tags">
                  {tags.map((tag) => (
                    <button
                      key={tag}
                      className={`tag-chip ${selectedTags.includes(tag) ? 'selected' : ''}`}
                      onClick={() => toggleTag(tag)}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <button className="all-tags-toggle" onClick={() => setAllTagsOpen((v) => !v)}>
            세부 태그 설정 보기 {allTagsOpen ? '▴' : '▾'}
          </button>

          {allTagsOpen && (
            <div className="all-tags-cloud">
              {allTagsSorted.map((tag) => (
                <button
                  key={tag}
                  className={`tag-chip ${selectedTags.includes(tag) ? 'selected' : ''}`}
                  onClick={() => toggleTag(tag)}
                >
                  {tag}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="empty-state">검색/필터 조건에 맞는 게임이 없어요.</div>
      ) : (
        <div className="grid">
          {filtered.map((game) => {
            const price = getPriceInfo(game);
            return (
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
                  {game.tags?.slice(0, 3).map((tag: string) => (
                    <span key={tag} className="category-tag">{tag}</span>
                  ))}
                  {game.is_free ? (
                    <span className="free-badge">무료 플레이</span>
                  ) : (
                    price && (
                      <div className="price-row">
                        {price.discount > 0 && (
                          <>
                            <span className="discount-badge">-{price.discount}%</span>
                            <span className="price-original">{price.formattedOriginal}</span>
                          </>
                        )}
                        <span className={`price-final ${price.discount === 0 ? 'no-discount' : ''}`}>
                          {price.formattedFinal}
                        </span>
                      </div>
                    )
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}