import type { Metadata } from 'next';
import { supabase } from '../../lib/supabase';
import BackToList from '../../components/BackToList';
import DiscountChart from '../../components/DiscountChart';
import { getPriceInfo } from '../../lib/price';
import { translateGenres } from '../../lib/genreTranslate';
import { getPlatformCategories, CATEGORY_LABEL, PlatformCategory } from '../../lib/platformDisplay';
import { FaPlaystation, FaXbox, FaDesktop, FaVrCardboard } from 'react-icons/fa';
import PlayerChart from '../../components/PlayerChart';
import YouTubeLite from '../../components/YouTubeLite';
import { translateTag } from '../../lib/tagTranslate';
import GameVotes from '../../components/GameVotes';

export const dynamic = 'force-dynamic';

const SAMPLE_STREAMERS = ['스트리머 A', '스트리머 B', '스트리머 C'];

const CATEGORY_ICON: Record<PlatformCategory, React.ReactNode> = {
  pc: <FaDesktop />,
  playstation: <FaPlaystation />,
  xbox: <FaXbox />,
  switch: <span style={{ fontSize: 18 }}>🎮</span>,
  vr: <FaVrCardboard />,
};

function getReviewClass(summary: string | null) {
  if (!summary) return '';
  if (summary.includes('긍정')) return 'positive';
  if (summary.includes('부정')) return 'negative';
  return 'mixed';
}

function parseMinSpec(raw: string | null) {
  if (!raw) return null;
  const lines = raw.split('/').map((s) => s.trim()).filter(Boolean);
  const result: { label: string; value: string }[] = [];
  for (const line of lines) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const label = line.slice(0, colonIdx).trim();
    const value = line.slice(colonIdx + 1).trim();
    if (!value || label.toLowerCase() === '최소') continue;
    if (value.length > 120) continue;
    result.push({ label, value });
  }
  return result.length > 0 ? result : null;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const { data: game } = await supabase
    .from('games')
    .select('name, description, fun_description, min_players, max_players, difficulty, tags, is_free, card_image_url, cover_image_url, price_history(price, discount_percent, checked_at)')
    .eq('id', id)
    .maybeSingle();
  if (!game) return { title: '게임을 찾을 수 없어요' };

  const players = game.min_players && game.max_players
    ? (game.min_players === game.max_players ? `${game.min_players}인` : `${game.min_players}-${game.max_players}인`)
    : '';
  const price = getPriceInfo(game);
  const priceText = game.is_free ? '무료' : price ? (price.discount > 0 ? `${price.formattedFinal} (-${price.discount}%)` : price.formattedFinal) : '';
  const summary = [players, game.difficulty, priceText].filter(Boolean).join(' · ');
  const tags = (game.tags || []).slice(0, 3).map((t: string) => '#' + translateTag(t)).join(' ');
  // 한 줄 소개가 있으면 그걸 맨 앞에 (카톡 미리보기에서 제일 먼저 보이는 문장)
  const desc = game.fun_description
    ? [game.fun_description, summary].filter(Boolean).join(' | ')
    : [summary, tags, (game.description || '').replace(/\s+/g, ' ').slice(0, 90)].filter(Boolean).join(' | ');
  const image = game.card_image_url || game.cover_image_url;

  return {
    title: summary ? `${game.name} — ${summary}` : game.name,
    description: desc,
    alternates: { canonical: `/games/${id}` },
    openGraph: { title: game.name, description: desc, url: `/games/${id}`, type: 'website', images: image ? [{ url: image }] : undefined },
    twitter: { card: 'summary_large_image', title: game.name, description: desc, images: image ? [image] : undefined },
  };
}

export default async function GameDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

    const { data: game, error } = await supabase
    .from('games')
    .select('*, price_history(price, discount_percent, checked_at), player_history(player_count, recorded_at), game_streamers(streamer_id, streamers(id, name, platform, handle))')
    .eq('id', id)
    .single();

  if (error || !game) {
    return <div className="page">게임을 찾을 수 없어요.</div>;
  }

  const price = getPriceInfo(game);
  // 100원 미만은 잘못 들어온 기록이라 할인 전적에서 제외
  const priceHistory = (game.price_history || []).filter((p: any) => p.price >= 100);
  const STORE_LABEL: Record<string, string> = { epic: '에픽 게임즈', battlenet: 'Battle.net', riot: '라이엇' };
  const buyUrl = game.steam_appid ? `https://store.steampowered.com/app/${game.steam_appid}` : game.store_url;
  const buyLabel = game.steam_appid ? 'Steam' : STORE_LABEL[game.source] ?? '공식 사이트';
  const subGenres = Array.from(
    new Set(translateGenres([...(game.genres || []), ...(game.themes || [])]))
  ).slice(0, 10);
  const platformCategories = getPlatformCategories(game.platform);

  return (
    <main className="page">
      <BackToList />

      {/* TOP_MEDIA — 영상이 있으면 영상만, 없으면 사진만 */}
      {game.video_url ? (
        <div className="video-section">
          <YouTubeLite url={game.video_url} title={`${game.name} 트레일러`} fallbackImage={game.hero_image_url || game.card_image_url || game.cover_image_url} />
        </div>
      ) : (
        <div className="detail-hero">
          <img src={game.hero_image_url || game.card_image_url || game.cover_image_url} alt={game.name} />
        </div>
      )}
      {/* 제목 + 평가 배지 + 태그 + 설명 */}
      <div className="detail-header">
        <h1 className="detail-title-v2">{game.name}</h1>
        <div className="detail-meta-line">
          {game.review_summary && (
            <span className={`review-badge ${getReviewClass(game.review_summary)}`}>
              {game.review_summary}
            </span>
          )}
          {game.is_early_access && (
            <span style={{ fontSize: 14, color: 'var(--accent)', fontWeight: 700, border: '1px solid var(--accent)', padding: '3px 10px', borderRadius: 100 }}>
              얼리 액세스
            </span>
          )}
          {game.category && <span className="badge-neutral">{game.category}</span>}
        </div>
        {game.tags?.length > 0 && (
          <div className="main-tag-row">
            {game.tags.map((tag: string) => (
              <span key={tag} className="category-tag">{tag}</span>
            ))}
          </div>
        )}
        {game.fun_description && (
          <p style={{
            margin: '14px 0 4px', padding: '12px 16px',
            borderLeft: '4px solid var(--accent)', borderRadius: 8,
            background: 'var(--bg-card)', fontSize: 17, fontWeight: 600, lineHeight: 1.6,
          }}>
            {game.fun_description}
          </p>
        )}
        {game.description && <p className="detail-description-v2">{game.description}</p>}
      </div>

      {/* 구매 카드 */}
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
              <span className="buy-price-final">
                {game.is_free ? '무료' : price ? price.formattedFinal : '가격 정보 없음'}
              </span>
            </div>
          </div>
          {buyUrl && (
            <a href={buyUrl} target="_blank" rel="noopener noreferrer" className="buy-cta">
              {buyLabel}에서 {game.is_free ? '플레이하기' : '구매하기'} →
            </a>
          )}
        </div>
      </div>

      {/* 플랫폼 */}
      {platformCategories.length > 0 && (
        <div className="platform-section">
          <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 12 }}>이용 가능한 플랫폼</h3>
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

      {/* 스펙 리스트 */}
      {/* SPEC_GROUPS — 플레이 / 게임 정보 / 스팀·가격 (항목이 없는 묶음은 CSS로 숨김) */}
      <section className="spec-group">
        <h3 className="spec-group-title">🎮 플레이 정보</h3>
        <div className="spec-list">
        <div className="spec-row">
          <span className="spec-label">인원수</span>
          <span className="spec-value">
            {game.min_players && game.max_players ? `${game.min_players}-${game.max_players}인` : '정보 없음'}
          </span>
        </div>
        {game.recommended_players && (
          <div className="spec-row">
            <span className="spec-label">추천 인원</span>
            <span className="spec-value" style={{ color: 'var(--accent)', fontWeight: 700 }}>
              {game.recommended_players}
            </span>
          </div>
        )}
        <div className="spec-row">
          <span className="spec-label">솔로 플레이</span>
          <span className="spec-value" style={{ color: game.solo_playable == null ? 'var(--text-dim)' : game.solo_playable ? '#4a9e3a' : 'var(--danger)', fontWeight: 700 }}>
            {game.solo_playable == null ? '정보 없음' : game.solo_playable && game.max_players === 1 ? '싱글 플레이 게임' : game.solo_playable ? '솔로 가능' : '멀티 필수'}
          </span>
        </div>
        <div className="spec-row">
          <span className="spec-label">난이도</span>
          <span className="spec-value">{game.difficulty || '정보 없음'}</span>
        </div>
        {game.story_length && (
          <div className="spec-row">
            <span className="spec-label">클리어까지</span>
            <span className="spec-value">{game.story_length}</span>
          </div>
        )}
        {game.is_esports && (
  <div className="spec-row">
    <span className="spec-label">e스포츠</span>
    <span className="spec-value" style={{ color: '#4a9e3a', fontWeight: 700 }}>
      공식 대회 있음
    </span>
  </div>
)}
        </div>
      </section>
      <section className="spec-group">
        <h3 className="spec-group-title">📋 게임 정보</h3>
        <div className="spec-list">
        {game.release_date && (
          <div className="spec-row">
            <span className="spec-label">출시일</span>
            <span className="spec-value">
              {new Date(game.release_date).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}
            </span>
          </div>
        )}
        {game.last_updated && (
          <div className="spec-row">
            <span className="spec-label">마지막 업데이트</span>
            <span className="spec-value" style={{
              color: (() => {
                const diff = (Date.now() - new Date(game.last_updated).getTime()) / (1000 * 60 * 60 * 24);
                return diff < 30 ? '#4a9e3a' : diff < 180 ? 'var(--text)' : 'var(--text-dimmer)';
              })()
            }}>
              {new Date(game.last_updated).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}
              {(() => {
                const diff = Math.floor((Date.now() - new Date(game.last_updated).getTime()) / (1000 * 60 * 60 * 24));
                if (diff < 30) return <span style={{ marginLeft: 8, fontSize: 14, color: '#4a9e3a', fontWeight: 700 }}>활발히 업데이트 중</span>;
                if (diff < 180) return <span style={{ marginLeft: 8, fontSize: 14, color: 'var(--text-dimmer)' }}>{Math.floor(diff / 30)}개월 전</span>;
                return <span style={{ marginLeft: 8, fontSize: 14, color: 'var(--danger)' }}>업데이트 없음</span>;
              })()}
            </span>
          </div>
        )}
        <div className="spec-row">
          <span className="spec-label">한국어</span>
          <span className="spec-value" style={{
            color: !game.korean_support || game.korean_support === '한국어 없음' ? 'var(--danger)' : '#4a9e3a',
            fontWeight: 700
          }}>
            {!game.korean_support || game.korean_support === '한국어 없음'
              ? '지원 안 함'
              : game.korean_support === '자막+더빙'
              ? '자막 · 더빙 지원'
              : '자막 지원'}
          </span>
        </div>
        {game.storage_gb && (
          <div className="spec-row">
            <span className="spec-label">필요 용량</span>
            <span className="spec-value">{game.storage_gb} GB</span>
          </div>
        )}
        {game.developer && (
          <div className="spec-row">
            <span className="spec-label">개발사</span>
            <span className="spec-value">{game.developer}</span>
          </div>
        )}
        {game.critic_score && (
          <div className="spec-row">
            <span className="spec-label">평론가 점수</span>
            <span className="spec-value">{game.critic_score}점</span>
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
      </section>
      <section className="spec-group">
        <h3 className="spec-group-title">💰 스팀 · 가격</h3>
        <div className="spec-list">
        {!game.is_free && game.lowest_price && (
          <div className="spec-row">
            <span className="spec-label">역대 최저가</span>
            <span className="spec-value">
              ₩{Math.round(game.lowest_price).toLocaleString('ko-KR')}
              {game.lowest_price_date && (
                <span style={{ color: 'var(--text-dimmer)', fontSize: 14, fontWeight: 400, marginLeft: 6 }}>
                  ({game.lowest_price_date})
                </span>
              )}
            </span>
          </div>
        )}
        {game.steam_appid && game.family_sharing !== null && game.family_sharing !== undefined && (
          <div className="spec-row">
            <span className="spec-label">Steam 가족 공유</span>
            <span className="spec-value" style={{ color: game.family_sharing ? '#4a9e3a' : 'var(--danger)' }}>
              {game.family_sharing ? '공유 가능' : '공유 불가'}
            </span>
          </div>
        )}
        {game.has_workshop && (
  <div className="spec-row">
    <span className="spec-label">모드 지원</span>
    <span className="spec-value" style={{ color: '#4a9e3a', fontWeight: 700 }}>
      Steam 창작마당 지원
    </span>
  </div>
)}
        {game.achievement_count && (
          <div className="spec-row">
            <span className="spec-label">도전과제</span>
            <span className="spec-value">{game.achievement_count.toLocaleString('ko-KR')}개</span>
          </div>
        )}
        {game.has_dlc && (
          <div className="spec-row">
            <span className="spec-label">DLC</span>
            <span className="spec-value">있음</span>
          </div>
        )}
        </div>
      </section>


      {/* 리뷰 패널 */}
      {(game.review_positive_percent || game.critic_score || game.heat_rank) && (
        <div className="review-panel">
          {game.review_positive_percent && (
            <div className="review-row">
              <div className="review-source">
                <span className="review-source-label">Steam 유저 평가</span>
                <span className="review-count">
                  {game.review_total?.toLocaleString('ko-KR')}개 리뷰 기준
                </span>
              </div>
              <div className="review-bar-wrap">
                <div className="review-bar-track">
                  <div className="review-bar-fill" style={{
                    width: `${game.review_positive_percent}%`,
                    background: game.review_positive_percent >= 80 ? '#4a9e3a' : game.review_positive_percent >= 60 ? '#d4a017' : '#d64545',
                  }} />
                  <div className="review-bar-neg" style={{ width: `${100 - game.review_positive_percent}%` }} />
                </div>
                <div className="review-bar-labels">
                  <span style={{ color: '#4a9e3a', fontWeight: 700 }}>👍 {game.review_positive_percent}%</span>
                  <span style={{ color: '#d64545', fontWeight: 700 }}>{100 - game.review_positive_percent}% 👎</span>
                </div>
              </div>
            </div>
          )}
          {game.heat_rank && (
            <div className="review-row">
              <div className="review-source">
                <span className="review-source-label">ITAD 인기 순위</span>
                <span className="review-count">IsThereAnyDeal 글로벌 기준</span>
              </div>
              <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--accent)' }}>
                #{game.heat_rank.toLocaleString('ko-KR')}위
              </span>
            </div>
          )}
        </div>
      )}

            {/* PC 사양 — 아코디언 */}
      {(game.min_spec || game.recommended_spec) && (
        <details className="detail-accordion">
          <summary>PC 사양 보기</summary>
          {game.min_spec && (() => {
            const parsed = parseMinSpec(game.min_spec);
            if (!parsed) return null;
            return (
              <div style={{ marginBottom: game.recommended_spec ? 24 : 0 }}>
                <p style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', marginBottom: 10, marginTop: 16, letterSpacing: '-0.01em' }}>최소 사양</p>
                <div className="spec-list">
                  {parsed.map(({ label, value }) => (
                    <div className="spec-row" key={label}>
                      <span className="spec-label">{label}</span>
                      <span className="spec-value" style={{ fontWeight: 500, fontSize: 15 }}>{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
          {game.recommended_spec && (() => {
            const parsed = parseMinSpec(game.recommended_spec);
            if (!parsed) return null;
            return (
              <div>
                <p style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', marginBottom: 10, marginTop: 8, letterSpacing: '-0.01em' }}>권장 사양</p>
                <div className="spec-list">
                  {parsed.map(({ label, value }) => (
                    <div className="spec-row" key={`rec-${label}`}>
                      <span className="spec-label">{label}</span>
                      <span className="spec-value" style={{ fontWeight: 500, fontSize: 15 }}>{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </details>
      )}

      {/* 더 자세히 — 엔딩/서버/활동만 */}
      {(game.has_ending !== null || game.server_type || game.activities?.length > 0) && (
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
            {game.activities?.length > 0 && (
              <div className="spec-row">
                <span className="spec-label">가능한 활동</span>
                <span className="spec-value spec-tags">
                  {game.activities.map((a: string) => (
                    <span key={a} className="activity-chip">{a}</span>
                  ))}
                </span>
              </div>
            )}
          </div>
          {game.ending_note && <p className="accordion-note">{game.ending_note}</p>}
        </details>
      )}

            {/* 플레이어 현황 */}
      {(game.current_players || game.player_history?.length >= 2) && (
        <section className="detail-section-v2">
          <h3>플레이어 현황</h3>
          <div className="player-stats">
            {game.current_players && (
              <div className="player-stat-card">
                <span className="player-stat-label">지금 접속 중</span>
                <span className="player-stat-num">
                  {game.current_players.toLocaleString('ko-KR')}명
                </span>
              </div>
            )}
            {game.peak_players && (
              <div className="player-stat-card">
                <span className="player-stat-label">역대 최고</span>
                <span className="player-stat-num">
                  {game.peak_players.toLocaleString('ko-KR')}명
                </span>
              </div>
            )}
          </div>
          {game.player_history?.length >= 2 && (
            <PlayerChart data={game.player_history} />
          )}
          <p style={{ fontSize: 14, color: 'var(--text-dimmer)', marginTop: 8 }}>
            Tracked from Steam · 매일 자정 갱신
          </p>
        </section>
      )}
<GameVotes gameId={game.id} />
            {/* 할인 전적 */}
      {!game.is_free && priceHistory.length === 1 && price && (
        <section className="detail-section-v2">
          <h3>할인 전적</h3>
          <p style={{ fontSize: 15, color: 'var(--text-dimmer)' }}>
            {price.discount > 0
              ? `지금 ${price.discount}% 할인 중 · ${price.formattedFinal}`
              : `아직 할인한 적 없어요 · ${price.formattedFinal}`}
          </p>
        </section>
      )}
      {!game.is_free && priceHistory.length >= 2 && (
        <section className="detail-section-v2">
          <h3>할인 전적</h3>
          <DiscountChart
            data={[...priceHistory]
              .sort((a: any, b: any) => new Date(a.checked_at).getTime() - new Date(b.checked_at).getTime())
              .map((p: any) => ({
                date: new Date(p.checked_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' }),
                discount: p.discount_percent,
              }))}
          />
        </section>
      )}

          {/* 스트리머 */}
      {game.game_streamers?.length > 0 && (
        <section className="detail-section-v2">
          <h3>이 게임을 플레이한 스트리머</h3>
          <div className="streamer-list">
            {game.game_streamers.map((gs: any) => {
              const s = gs.streamers;
              const platformLabel =
                s.platform === 'chzzk' ? '치지직' :
                s.platform === 'youtube' ? '유튜브' :
                s.platform === 'soop' ? '숲(SOOP)' : s.platform;
              return (
                <a key={s.id} href={s.handle} target="_blank" rel="noopener noreferrer" className="streamer-chip">
                  <span className="streamer-name">{s.name}</span>
                  <span className="streamer-platform">{platformLabel}</span>
                </a>
              );
            })}
          </div>
        </section>
      )}
    </main>
  );
}