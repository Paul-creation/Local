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
          {game.category && <span className="badge-neutral">{game.category}</span>}
          {game.platform?.[0] && <span className="badge-neutral">{game.platform[0]}</span>}
        </div>
        {game.description && <p className="detail-description-v2">{game.description}</p>}
      </div>

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
        {game.genres?.length > 0 && (
          <div className="spec-row">
            <span className="spec-label">장르</span>
            <span className="spec-value">{game.genres.join(', ')}</span>
          </div>
        )}
        {game.themes?.length > 0 && (
          <div className="spec-row">
            <span className="spec-label">테마</span>
            <span className="spec-value">{game.themes.join(', ')}</span>
          </div>
        )}
        {game.tags?.length > 0 && (
          <div className="spec-row">
            <span className="spec-label">태그</span>
            <span className="spec-value spec-tags">
              {game.tags.map((tag: string) => (
                <span key={tag} className="badge-neutral">{tag}</span>
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