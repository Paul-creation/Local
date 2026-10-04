import type { Metadata } from 'next';
import { supabase } from '../../lib/supabase';
import BackToList from '../../components/BackToList';
import DiscountChart from '../../components/DiscountChart';
import { getPriceInfo, getLowestTiming, PRICE_TYPE_LABEL } from '../../lib/price';
import { formatDate } from '../../lib/date';
import LowestPriceBadge from '../../components/LowestPriceBadge';
import { translateGenres } from '../../lib/genreTranslate';
import { getPlatformCategories, CATEGORY_LABEL, PlatformCategory } from '../../lib/platformDisplay';
import { FaPlaystation, FaXbox, FaDesktop, FaVrCardboard } from 'react-icons/fa';
import PlayerChart from '../../components/PlayerChart';
import YouTubeLite from '../../components/YouTubeLite';
import { translateTag } from '../../lib/tagTranslate';
import GameVotes from '../../components/GameVotes';
import VideoPreviewSection, { type CoopVideo } from '../../components/VideoPreviewSection';
import Link from 'next/link';
import ShareButton from '../../components/ShareButton';
import GotyBadge from '../../components/GotyBadge';
import GameImage from '../../components/GameImage';
import { getTop10Ids } from '../../lib/hotChart';
import { playersText } from '../../lib/players';
import { badgeClass } from '../../lib/badge.mjs';
import GameOpinions from '../../components/community/GameOpinions';
import RelatedPosts from '../../components/community/RelatedPosts';
import { selectGames, mergedTargetOf } from '../../lib/visibleGames';
import ContentNotice from '../../components/ContentNotice';
import { permanentRedirect } from 'next/navigation';

// 게임마다 처음 열릴 때 만들고 1시간 동안 재사용 (ISR). 가격·접속자는 하루 한 번 갱신되므로 충분
// 의견 작성·수정·삭제(api/game-comments)와 신고 자동 숨김(api/community/report)은 그 게임 페이지를 바로 새로 만든다
// 메인 카드의 <Link>가 화면에 보이면 상세를 미리 불러오므로(prefetch) 짧게 잡으면 방문마다 재생성이 몰린다
export const revalidate = 3600;
export async function generateStaticParams() {
  return []; // 빌드 때 미리 만들지 않고, 처음 방문할 때 만든다 (빈 배열이어야 ISR이 켜짐)
}

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
  const { data: game } = await selectGames('name, description, fun_description, min_players, max_players, difficulty, tags, is_free, price_type, price_history(price, discount_percent, checked_at)')
    .eq('id', id)
    .maybeSingle();
  if (!game) {
    // 숨긴 중복 게임이면 남긴 게임으로 영구 이동 (메타데이터 단계에서 먼저 처리해야 308 응답이 됨)
    const target = await mergedTargetOf(id);
    if (target) permanentRedirect(`/games/${target}`);
    return { title: '게임을 찾을 수 없어요' };
  }

  const players = playersText(game);
  const price = getPriceInfo(game);
  const priceText = game.is_free ? '무료' : price ? (price.discount > 0 ? `${price.formattedFinal} (-${price.discount}%)` : price.formattedFinal) : '';
  const summary = [players, game.difficulty, priceText].filter(Boolean).join(' · ');
  const tags = (game.tags || []).slice(0, 3).map((t: string) => '#' + translateTag(t)).join(' ');
  // 한 줄 소개가 있으면 그걸 맨 앞에 (카톡 미리보기에서 제일 먼저 보이는 문장)
  const desc = game.fun_description
    ? [game.fun_description, summary].filter(Boolean).join(' | ')
    : [summary, tags, (game.description || '').replace(/\s+/g, ' ').slice(0, 90)].filter(Boolean).join(' | ');
  const image = `/api/og/game/${id}`;

  return {
    title: summary ? `${game.name} — ${summary}` : game.name,
    description: desc,
    alternates: { canonical: `/games/${id}` },
    openGraph: { title: game.name, description: desc, url: `/games/${id}`, type: 'website', images: [{ url: image, width: 1200, height: 630 }] },
    twitter: { card: 'summary_large_image', title: game.name, description: desc, images: [image] },
  };
}

export default async function GameDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const top10Promise = getTop10Ids().catch(() => [] as string[]);
    const { data: game, error } = await selectGames('*, price_history(price, discount_percent, checked_at), player_history(player_count, recorded_at), game_streamers(streamer_id, streamers(id, name, platform, handle)), game_videos(kind, video_id, title, channel_title, published_at, view_count)')
    .eq('id', id)
    .single();

  if (error || !game) {
    const target = await mergedTargetOf(id);
    if (target) permanentRedirect(`/games/${target}`);
    return <div className="page">게임을 찾을 수 없어요.</div>;
  }
  const isTop10 = (await top10Promise).includes(game.id);
  // 같은 시리즈 (series_id가 있을 때만, 출시순)
  const { data: seriesGames } = game.series_id
    ? await selectGames('id, name, card_image_url, cover_image_url, series_order').eq('series_id', game.series_id).order('series_order')
    : { data: null };
  const { data: series } = game.series_id && (seriesGames?.length ?? 0) > 1
    ? await supabase.from('series').select('name_ko').eq('id', game.series_id).maybeSingle()
    : { data: null };

  const price = getPriceInfo(game);
  // 100원 미만은 잘못 들어온 기록이라 할인 전적에서 제외
  const priceHistory = (game.price_history || []).filter((p: any) => p.price >= 100);
  // 무료·가격 유형 게임(월 구독·판매처에서 확인)은 역대 최저·할인 그래프를 숨김 (기록은 DB에 그대로)
  const showPriceRecord = !game.is_free && !game.price_type;
  const STORE_LABEL: Record<string, string> = { epic: '에픽 게임즈', battlenet: 'Battle.net', riot: '라이엇' };
  const buyUrl = game.steam_appid ? `https://store.steampowered.com/app/${game.steam_appid}` : game.store_url;
  const buyLabel = game.steam_appid ? 'Steam' : STORE_LABEL[game.source] ?? '공식 사이트';
  const subGenres = Array.from(
    new Set(translateGenres([...(game.genres || []), ...(game.themes || [])]))
  ).slice(0, 10);
  const platformCategories = getPlatformCategories(game.platform);
  // 나무위키 검색 이동 — 한국어 이름(search_name_ko의 첫 번째)이 없으면 영문 이름
  const namuQuery = String(game.search_name_ko || '').split(',')[0].trim() || game.name;
  const namuUrl = `https://namu.wiki/Go?q=${encodeURIComponent(namuQuery)}`;

  return (
    <main className="page">
      <BackToList />

      {/* TOP_MEDIA — 영상이 있으면 영상만, 없으면 사진만 */}
      {game.video_url ? (
        <div className="video-section">
          <YouTubeLite url={game.video_url} title={`${game.name} 트레일러`} fallbackImage={game.hero_image_url || game.card_image_url || game.cover_image_url} wide fetchPriority="high" />
        </div>
      ) : (
        <div className="detail-hero">
          {/* 뒤: 같은 이미지를 흐리게 칸 전체에 (같은 주소라 한 번만 받음) / 앞: 원본을 잘림 없이 가운데에 — globals.css .detail-hero */}
          <GameImage src={game.hero_image_url || game.card_image_url || game.cover_image_url} fallbackWidth={1280} alt="" aria-hidden="true" className="img-backdrop" />
          <GameImage src={game.hero_image_url || game.card_image_url || game.cover_image_url} fallbackWidth={1280} alt={game.name} fetchPriority="high" />
        </div>
      )}
      {/* 제목 + 평가 배지 + 태그 + 설명 */}
      <div className="detail-header">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <h1 className="detail-title-v2">
            {game.name}
            {isTop10 && <span className="top10-badge" style={{ marginLeft: 10, fontSize: 13, position: 'relative', top: -4 }}>TOP 10</span>}
          </h1>
          <ShareButton
            title={game.name}
            text={game.fun_description || `${game.name} 같이 할래?`}
          />
        </div>
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
          <GotyBadge awards={game.goty_awards} all />
          {game.category && <span className={`badge-neutral ${badgeClass(game.category)}`}>{game.category}</span>}
          <a href={namuUrl} target="_blank" rel="noopener nofollow" className="namu-link">나무위키 ↗</a>
          {game.discord_url && (
            <a href={game.discord_url} target="_blank" rel="noopener nofollow" className="discord-link">공식 디스코드 ↗</a>
          )}
        </div>
        {game.tags?.length > 0 && (
          <div className="main-tag-row">
            {game.tags.map((tag: string) => (
              <span key={tag} className="category-tag">{tag}</span>
            ))}
          </div>
        )}
        <ContentNotice ids={game.content_descriptor_ids} />
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
                {game.is_free ? '무료'
                  : price ? price.formattedFinal
                  : game.price_type === 'check_store' && buyUrl
                    ? <a href={buyUrl} target="_blank" rel="noopener noreferrer">{PRICE_TYPE_LABEL.check_store}</a>
                    : PRICE_TYPE_LABEL[game.price_type] ?? '가격 정보 없음'}
              </span>
              <LowestPriceBadge timing={getLowestTiming(game, price)} />
            </div>
            {showPriceRecord && game.lowest_price >= 100 && (
              <span className="buy-lowest">
                역대 최저 ₩{Math.round(game.lowest_price).toLocaleString('ko-KR')}
                {formatDate(game.lowest_price_date) && ` (${formatDate(game.lowest_price_date)})`}
              </span>
            )}
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
            {playersText(game) || '인원 정보 확인 중'}
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
              {formatDate(game.release_date)}
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
              {formatDate(game.last_updated)}
              {(() => {
                const diff = Math.floor((Date.now() - new Date(game.last_updated).getTime()) / (1000 * 60 * 60 * 24));
                if (diff < 30) return <span style={{ display: 'inline-block', marginLeft: 8, fontSize: 14, color: '#4a9e3a', fontWeight: 700 }}>활발히 업데이트 중</span>;
                if (diff < 180) return <span style={{ display: 'inline-block', marginLeft: 8, fontSize: 14, color: 'var(--text-dimmer)' }}>{Math.floor(diff / 30)}개월 전</span>;
                return <span style={{ display: 'inline-block', marginLeft: 8, fontSize: 14, color: 'var(--danger)' }}>업데이트 없음</span>;
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
        {showPriceRecord && game.lowest_price && (
          <div className="spec-row">
            <span className="spec-label">역대 최저가</span>
            <span className="spec-value">
              ₩{Math.round(game.lowest_price).toLocaleString('ko-KR')}
              {formatDate(game.lowest_price_date) && (
                <span style={{ display: 'inline-block', color: 'var(--text-dimmer)', fontSize: 14, fontWeight: 400, marginLeft: 6 }}>
                  ({formatDate(game.lowest_price_date)})
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

      {/* 같은 시리즈 — 출시순, 지금 게임 강조 */}
      {seriesGames && seriesGames.length > 1 && (
        <section className="series-section">
          <h3 className="spec-group-title">같은 시리즈{series?.name_ko ? ` · ${series.name_ko}` : ''}</h3>
          <ol className="series-list">
            {seriesGames.map((s) => {
              const current = s.id === game.id;
              const inner = (
                <>
                  <GameImage src={s.card_image_url || s.cover_image_url} steamSize="header_292x136" loading="lazy" />
                  <span className="series-name">{s.name}</span>
                </>
              );
              return (
                <li key={s.id}>
                  {current ? (
                    <div className="series-item is-current" aria-current="page">{inner}</div>
                  ) : (
                    <Link href={`/games/${s.id}`} className="series-item">{inner}</Link>
                  )}
                </li>
              );
            })}
          </ol>
        </section>
      )}

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
      <GameOpinions gameId={game.id} />
      <RelatedPosts gameId={game.id} />
            {/* 할인 전적 */}
      {showPriceRecord && priceHistory.length === 1 && price && (
        <section className="detail-section-v2">
          <h3>할인 전적</h3>
          <p style={{ fontSize: 15, color: 'var(--text-dimmer)' }}>
            {price.discount > 0
              ? `지금 ${price.discount}% 할인 중 · ${price.formattedFinal}`
              : `아직 할인한 적 없어요 · ${price.formattedFinal}`}
          </p>
        </section>
      )}
      {showPriceRecord && priceHistory.length >= 2 && (
        <section className="detail-section-v2">
          <h3>할인 전적</h3>
          {/* 기간 기준 시각은 서버에서 정해 넘긴다 (서버·브라우저 계산이 어긋나지 않게) */}
          <DiscountChart history={priceHistory} now={Date.now()} />
        </section>
      )}

      {/* 영상으로 미리 보기 — 하이라이트 + 친구랑 플레이(멀티 게임만) + 스트리머 */}
      <VideoPreviewSection
        highlights={((game.game_videos || []) as (CoopVideo & { kind: string })[])
          .filter((v) => v.kind === 'highlight')
          .sort((a, b) => (b.view_count || 0) - (a.view_count || 0))
          .slice(0, 3)}
        videos={game.max_players > 1
          ? ((game.game_videos || []) as (CoopVideo & { kind: string })[])
              .filter((v) => v.kind === 'coop')
              .sort((a, b) => (b.view_count || 0) - (a.view_count || 0))
              .slice(0, 3)
          : []}
        streamers={game.game_streamers?.length > 0 ? (
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
        ) : null}
      />
    </main>
  );
}