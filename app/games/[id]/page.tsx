import { supabase } from '../../lib/supabase';
import Link from 'next/link';
import DiscountChart from '../../components/DiscountChart';
import { getPriceInfo } from '../../lib/price';
import { translateGenres } from '../../lib/genreTranslate';
import { getPlatformCategories, CATEGORY_LABEL, PlatformCategory } from '../../lib/platformDisplay';
import { SiPlaystation, SiNintendoswitch, SiXbox } from 'react-icons/si';
import { FaDesktop, FaVrCardboard } from 'react-icons/fa';

export const dynamic = 'force-dynamic';

const SAMPLE_DISCOUNT_HISTORY = [
  { date: '3개월 전', discount: 0 },
  { date: '2개월 전', discount: 20 },
  { date: '1개월 전', discount: 0 },
  { date: '지금', discount: 30 },
];
const SAMPLE_STREAMERS = ['스트리머 A', '스트리머 B', '스트리머 C'];

const CATEGORY_ICON: Record<PlatformCategory, React.ReactNode> = {
  pc: <FaDesktop />,
  playstation: <SiPlaystation />,
  xbox: <SiXbox />,
  switch: <SiNintendoswitch />,
  vr: <FaVrCardboard />,
};

function getReviewClass(summary: string | null) {
  if (!summary) return '';
  if (summary.includes('긍정')) return 'positive';
  if (summary.includes('부정')) return 'negative';
  return 'mixed';
}

export default async function GameDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const { data: game, error } = await supabase
    .from('games')
    .select('*, price_history(price, discount_percent)')
    .eq('id', id)
    .single();

  if (error || !game) {
    return <div className="page">게임을 찾을 수 없어요.</div>;
  }

  const price = getPriceInfo(game);
  const steamUrl = `https://store.steampowered.com/app/${game.steam_appid}`;
  const subGenres = Array.from(
    new Set(translateGenres([...(game.genres || []), ...(game.themes || [])]))
  ).slice(0, 10);
  const platformCategories = getPlatformCategories(game.platform);

  return (
    <main className="page">
      <Link href="/" className="back-link">← 목록으로</Link>

      <div className="detail-hero">
        <img src={game.cover_image_url} alt={game.name} />
      </div>

      <div className="detail-header">
        <h1 className="detail-title-v2">{game.name}</h1>
        <div className="detail-meta-line">
          {game.review_summary && (
            <span className={`review-badge ${getReviewClass(game.review_summary)}`}>
              {game.review_summary}
            </span>
          )}
          {game.age_rating && <span className="age-badge">{game.age_rating}</span>}
        </div>
        {game.tags?.length > 0 && (
          <div className="main-tag-row">
            {game.tags.map((tag: string) => (
              <span key={tag} className="category-tag">{tag}</span>
            ))}
          </div>
        )}
        {game.description && <p className="detail-description-v2">{game.description}</p>}
      </div>

      <div className="buy-card">
        <div className="buy-top">
          <div className="buy-price-block">
            <span className="buy-label">지금 바로 구매하세요!</span>
            <div className="buy-price-row">
              {price && price.discount > 0 && (
                <>
                  <span className="buy-discount-badge">-{price.discount}%</span>
                  <span className="buy-price-original">{price.formattedOriginal}</span>
                </>
              )}
              <span className="buy-price-final">{price ? price.formattedFinal : '가격 정보 없음'}</span>
            </div>
          </div>
          <a href={steamUrl} target="_blank" rel="noopener noreferrer" className="buy-cta">
            Steam에서 구매하기 →
          </a>
        </div>
      </div>

      {platformCategories.length > 0 && (
        <div className="platform-section">
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>이용 가능한 플랫폼</h3>
          <div className="platform-grid">
            {platformCategories.map((cat) => (
              <div key={cat} className="platform-card">
                <span className="platform-card-icon">{CATEGORY_ICON[cat]}</span>
                <span className="platform-card-label">{CATEGORY_LABEL[cat]}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="spec-list">
        <div className="spec-row">
          <span className="spec-label">인원수</span>
          <span className="spec-value">
            {game.min_players && game.max_players ? `${game.min_players}-${game.max_players}인` : '정보 없음'}
          </span>
        </div>
        <div className="spec-row">
          <span className="spec-label">난이도</span>
          <span className="spec-value">{game.difficulty || '정보 없음'}</span>
        </div>
        <div className="spec-row">
          <span className="spec-label">클리어까지</span>
          <span className="spec-value">{game.story_length || '정보 없음'}</span>
        </div>
        {game.critic_score && (
          <div className="spec-row">
            <span className="spec-label">평론가 점수</span>
            <span className="spec-value">{game.critic_score}점</span>
          </div>
        )}
        {game.developer && (
          <div className="spec-row">
            <span className="spec-label">개발사</span>
            <span className="spec-value">{game.developer}</span>
          </div>
        )}
        {subGenres.length > 0 && (
          <div className="spec-row">
            <span className="spec-label">장르</span>
            <span className="spec-value spec-tags">
              {subGenres.map((g) => (
                <span key={g} className="badge-neutral">{g}</span>
              ))}
            </span>
          </div>
        )}
      </div>

      {(game.has_ending !== null || game.server_type || game.min_spec) && (
        <details className="detail-accordion">
          <summary>더 자세히 들어가 보시겠어요?</summary>
          <div className="spec-list">
            {game.has_ending !== null && (
              <div className="spec-row">
                <span className="spec-label">엔딩 유무</span>
                <span className="spec-value">{game.has_ending ? '있음' : '없음'}</span>
              </div>
            )}
            {game.server_type && (
              <div className="spec-row">
                <span className="spec-label">서버 방식</span>
                <span className="spec-value">{game.server_type}</span>
              </div>
            )}
            {game.min_spec && (
              <div className="spec-row">
                <span className="spec-label">최소 사양</span>
                <span className="spec-value" style={{ fontWeight: 500 }}>{game.min_spec}</span>
              </div>
            )}
          </div>
          {game.ending_note && <p className="accordion-note">{game.ending_note}</p>}
        </details>
      )}

      <section className="detail-section-v2">
        <h3>할인 전적<span className="sample-note">※ 샘플 데이터</span></h3>
        <DiscountChart data={SAMPLE_DISCOUNT_HISTORY} />
      </section>

      <section className="detail-section-v2">
        <h3>이 게임을 플레이한 스트리머<span className="sample-note">※ 샘플 데이터</span></h3>
        <div className="streamer-list">
          {SAMPLE_STREAMERS.map((s) => (
            <span key={s} className="streamer-chip">{s}</span>
          ))}
        </div>
      </section>
    </main>
  );
}