import { supabase } from '../../lib/supabase';
import Link from 'next/link';
import DiscountChart from '../../components/DiscountChart';

export const dynamic = 'force-dynamic';

const SAMPLE_DISCOUNT_HISTORY = [
  { date: '3개월 전', discount: 0 },
  { date: '2개월 전', discount: 20 },
  { date: '1개월 전', discount: 0 },
  { date: '지금', discount: 30 },
];
const SAMPLE_STREAMERS = ['스트리머 A', '스트리머 B', '스트리머 C'];

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
    .select('*')
    .eq('id', id)
    .single();

  if (error || !game) {
    return <div className="page">게임을 찾을 수 없어요.</div>;
  }

  const topTags = game.tags?.slice(0, 3) || [];
  const remainingTags = game.tags?.slice(3) || [];

  return (
    <main className="page">
      <Link href="/" className="back-link">← 목록으로</Link>

      <div className="detail-hero">
        <img src={game.cover_image_url} alt={game.name} />
      </div>

      <h1 className="detail-title">{game.name}</h1>
      <div className="detail-tags">
        {game.category && <span className="category-tag">{game.category}</span>}
        {game.platform?.[0] && <span className="tag-badge">{game.platform[0]}</span>}
        {game.review_summary && (
          <span className={`review-badge ${getReviewClass(game.review_summary)}`}>
            {game.review_summary}
          </span>
        )}
        {topTags.map((tag: string) => (
          <span key={tag} className="category-tag">{tag}</span>
        ))}
      </div>

      {game.description && <p className="detail-description">{game.description}</p>}

      {(game.critic_score || game.developer || game.genres?.length > 0 || game.themes?.length > 0) && (
        <div className="detail-grid-auto">
          {game.critic_score && (
            <div className="detail-block">
              <span className="detail-label">평론가 점수</span>
              <span className="detail-value">{game.critic_score}점</span>
            </div>
          )}
          {game.developer && (
            <div className="detail-block">
              <span className="detail-label">개발사</span>
              <span className="detail-value">{game.developer}</span>
            </div>
          )}
          {game.genres?.length > 0 && (
            <div className="detail-block">
              <span className="detail-label">장르</span>
              <span className="detail-value">{game.genres.join(', ')}</span>
            </div>
          )}
          {game.themes?.length > 0 && (
            <div className="detail-block">
              <span className="detail-label">테마</span>
              <span className="detail-value">{game.themes.join(', ')}</span>
            </div>
          )}
        </div>
      )}

      {remainingTags.length > 0 && (
        <div className="all-tags-row">
          {remainingTags.map((tag: string) => (
            <span key={tag} className="tag-chip-static">{tag}</span>
          ))}
        </div>
      )}

      <div className="detail-grid">
        <div className="detail-block">
          <span className="detail-label">인원수</span>
          <span className="detail-value">
            {game.min_players && game.max_players ? `${game.min_players}-${game.max_players}인` : '정보 없음'}
          </span>
        </div>
        <div className="detail-block">
          <span className="detail-label">난이도</span>
          <span className="detail-value">{game.difficulty || '정보 없음'}</span>
        </div>
        <div className="detail-block">
          <span className="detail-label">클리어까지</span>
          <span className="detail-value">{game.story_length || '정보 없음'}</span>
        </div>
      </div>

      {(game.has_ending !== null || game.server_type || game.min_spec) && (
        <section className="detail-section">
          <h3>매니아 정보</h3>
          <div className="detail-grid-auto">
            {game.has_ending !== null && (
              <div className="detail-block">
                <span className="detail-label">엔딩 유무</span>
                <span className="detail-value">{game.has_ending ? '있음' : '없음'}</span>
              </div>
            )}
            {game.server_type && (
              <div className="detail-block">
                <span className="detail-label">서버 방식</span>
                <span className="detail-value">{game.server_type}</span>
              </div>
            )}
            {game.min_spec && (
              <div className="detail-block" style={{ gridColumn: '1 / -1' }}>
                <span className="detail-label">최소 사양</span>
                <span className="detail-value" style={{ fontWeight: 500, fontSize: 13 }}>{game.min_spec}</span>
              </div>
            )}
          </div>
          {game.ending_note && (
            <p className="detail-description" style={{ marginTop: -12 }}>{game.ending_note}</p>
          )}
        </section>
      )}

      <section className="detail-section">
        <h3>할인 전적<span className="sample-note">※ 샘플 데이터</span></h3>
        <DiscountChart data={SAMPLE_DISCOUNT_HISTORY} />
      </section>

      <section className="detail-section">
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