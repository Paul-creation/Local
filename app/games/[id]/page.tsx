import { supabase } from '../../lib/supabase';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

const SAMPLE_DISCOUNT_HISTORY = [
  { date: '3개월 전', discount: 0 },
  { date: '2개월 전', discount: 20 },
  { date: '1개월 전', discount: 0 },
  { date: '지금', discount: 30 },
];
const SAMPLE_STREAMERS = ['스트리머 A', '스트리머 B', '스트리머 C'];

export default async function GameDetail({ params }: { params: { id: string } }) {
  const { data: game, error } = await supabase
    .from('games')
    .select('*')
    .eq('id', params.id)
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

      <h1 className="detail-title">{game.name}</h1>
      <div className="detail-tags">
        {game.category && <span className="category-tag">{game.category}</span>}
        {game.platform?.[0] && <span className="platform-badge">{game.platform[0]}</span>}
      </div>

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

      <section className="detail-section">
        <h3>할인 전적<span className="sample-note">※ 샘플 데이터</span></h3>
        <div className="discount-row">
          {SAMPLE_DISCOUNT_HISTORY.map((d, i) => (
            <div key={i} className="discount-chip">
              <span className="discount-date">{d.date}</span>
              <span className={`discount-value ${d.discount > 0 ? 'is-discount' : ''}`}>
                {d.discount > 0 ? `-${d.discount}%` : '정가'}
              </span>
            </div>
          ))}
        </div>
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