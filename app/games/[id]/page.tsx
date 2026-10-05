import type { Metadata } from 'next';
import { supabase } from '../../lib/supabase';
import BackToList from '../../components/BackToList';
import DiscountChart from '../../components/DiscountChart';
import { getPriceInfo, getLowestTiming, PRICE_TYPE_LABEL } from '../../lib/price';
import { formatDate } from '../../lib/date';
import LowestPriceBadge from '../../components/LowestPriceBadge';
import { translateGenres } from '../../lib/genreTranslate';
import { getPlatformCategories, CATEGORY_LABEL } from '../../lib/platformDisplay';
import PlayerChart from '../../components/PlayerChart';
import DetailHero from '../../components/DetailHero';
import AddToCompare from '../../components/AddToCompare';
import { translateTag } from '../../lib/tagTranslate';
import GameVotes from '../../components/GameVotes';
import PlayerCountVote from '../../components/PlayerCountVote';
import { buyTimingLine, SAME_AS_LOWEST } from '../../lib/buyTiming';
import VideoPreviewSection, { type CoopVideo } from '../../components/VideoPreviewSection';
import Link from 'next/link';
import { Fragment } from 'react';
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
import TagHelp from '../../components/search/TagHelp';
import TagChips from '../../components/TagChips';
import { buildTree, tagName, type TagDict } from '../../lib/tagTree';
import tagDict from '../../lib/tag-search-dict.json';
import { permanentRedirect } from 'next/navigation';

// 게임마다 처음 열릴 때 만들고 1시간 동안 재사용 (ISR). 가격·접속자는 하루 한 번 갱신되므로 충분
// 의견 작성·수정·삭제(api/game-comments)와 신고 자동 숨김(api/community/report)은 그 게임 페이지를 바로 새로 만든다
// 메인 카드의 <Link>가 화면에 보이면 상세를 미리 불러오므로(prefetch) 짧게 잡으면 방문마다 재생성이 몰린다
type Ch = { channel_title: string | null; streamer_name: string };
export const revalidate = 3600;
export async function generateStaticParams() {
  return []; // 빌드 때 미리 만들지 않고, 처음 방문할 때 만든다 (빈 배열이어야 ISR이 켜짐)
}

const TAG_TREE = buildTree(tagDict as unknown as TagDict);

// 혼자 플레이 단계 (data/meta/play-modes.json → games.solo_mode)
const SOLO_LABEL: Record<string, string> = { story: '혼자서도 꽉 참', possible: '혼자도 가능', none: '멀티 전용' };

// 이 게임의 태그 이름 — game_tags(순위순) + 태그 나무 이름. 표가 아직 없거나 비어 있으면 예전 tags 칸 그대로
async function getGameTagNames(game: { id: string; tags?: string[] | null }) {
  const { data, error } = await supabase.from('game_tags').select('tag_id, rank').eq('game_id', game.id).order('rank');
  const names = !error && data?.length ? data.map((r) => tagName(TAG_TREE, r.tag_id)).filter(Boolean) : [];
  return names.length ? names : (game.tags || []).map(translateTag);
}

// PC 사양 접기 요약에 쓰는 그래픽카드 — 사양 줄 중 그래픽 항목의 첫 제품명만 짧게
function gpuOf(spec: { label: string; value: string }[] | null) {
  const row = spec?.find((r) => /그래픽|graphics|gpu|video/i.test(r.label));
  if (!row) return null;
  const first = row.value.split(/\s*(?:\/|,|또는| or )\s*/i)[0].trim();
  return first.length > 32 ? `${first.slice(0, 31)}…` : first;
}

// 마지막 업데이트로부터 지난 날 → 표시 (30일 안: 활발히 업데이트 중)
function updateState(date: string) {
  const diff = Math.floor((Date.now() - new Date(date).getTime()) / 86400000);
  if (diff < 30) return { cls: 'is-up', text: '활발히 업데이트 중' };
  if (diff < 180) return { cls: '', text: `${Math.floor(diff / 30)}개월 전` };
  return { cls: 'is-down', text: '업데이트 없음' };
}

// 평론가 점수 원형 게이지 (0~100)
function ScoreRing({ score }: { score: number }) {
  const r = 22, c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, score));
  return (
    <svg className="score-ring" width="56" height="56" viewBox="0 0 56 56" role="img" aria-label={`평론가 점수 ${v}점`}>
      <circle cx="28" cy="28" r={r} className="score-ring-track" />
      <circle cx="28" cy="28" r={r} className="score-ring-fill" strokeDasharray={`${(c * v) / 100} ${c}`} transform="rotate(-90 28 28)" />
      <text x="28" y="29" textAnchor="middle" dominantBaseline="middle" className="score-ring-num">{v}</text>
    </svg>
  );
}

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
    const { data: game, error } = await selectGames('*, price_history(price, discount_percent, checked_at), player_history(player_count, recorded_at), game_streamers(streamer_id, streamers(id, name, platform, handle)), game_videos(kind, video_id, title, channel_title, published_at, view_count), streamer_videos(video_id, title, published_at, streamer_channels(channel_title, streamer_name))')
    .order('published_at', { referencedTable: 'streamer_videos', ascending: false })
    .limit(24, { referencedTable: 'streamer_videos' })
    .eq('id', id)
    .single();

  if (error || !game) {
    const target = await mergedTargetOf(id);
    if (target) permanentRedirect(`/games/${target}`);
    return <div className="page">게임을 찾을 수 없어요.</div>;
  }
  const [top10, tagNames] = await Promise.all([top10Promise, getGameTagNames(game)]);
  const isTop10 = top10.includes(game.id);
  // 멀티 방식(전용 서버/P2P)은 온라인 협동·대전이 있는 게임만
  const showHost = !!game.multiplayer_host && (game.has_online_coop === true || game.has_pvp === true);
  // 친구랑: 팀 인원(party_max), 없으면 최대 인원 + 같은 서버 인원(session_max)
  const friendsMax = game.party_max ?? game.max_players;
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

  const heroImage = game.hero_image_url || game.card_image_url || game.cover_image_url;
  const timing = getLowestTiming(game, price);
  const minSpec = parseMinSpec(game.min_spec);
  const recSpec = parseMinSpec(game.recommended_spec);
  const gpuSummary = [gpuOf(minSpec) && `최소 ${gpuOf(minSpec)}`, gpuOf(recSpec) && `권장 ${gpuOf(recSpec)}`].filter(Boolean).join(' · ');
  const nexusUrl = `https://www.nexusmods.com/search?gameName=${encodeURIComponent(game.name)}`;
  const koreanOk = !!game.korean_support && game.korean_support !== '한국어 없음';
  // 최근 30일 평가 — 리뷰 30개 이상일 때만, 전체와 15%p 이상 차이면 한 줄 안내
  const recentPct: number | null = game.recent_review_pct ?? null;
  const showRecent = recentPct != null && (game.recent_review_count ?? 0) >= 30;
  const recentGap = showRecent && game.review_positive_percent ? recentPct! - game.review_positive_percent : 0;
  // 구매 타이밍 한 줄 (사실만, 할인 3번 미만이면 null)
  const timingLine = showPriceRecord && price
    ? buyTimingLine(priceHistory, { currentPrice: price.final, currentDiscount: price.discount, lowestPrice: game.lowest_price ?? null, now: Date.now() })
    : null;
  const isMulti = (game.party_max ?? game.max_players ?? 0) > 1;
  const playersChip = game.max_players === 1 ? '혼자' : playersText(game);
  const hasSteamCard = !!(game.review_positive_percent || game.heat_rank || game.critic_score || game.achievement_count || (game.steam_appid && game.family_sharing != null) || game.has_dlc != null);
  const hasMore = game.has_ending != null || game.server_type || game.activities?.length > 0 || game.story_length || game.is_esports || game.has_workshop || subGenres.length > 0;

  return (
    <main className="page detail-page">
      <BackToList />

      <DetailHero
        image={heroImage}
        videoUrl={game.video_url || null}
        name={game.name}
        badges={
          <>
            {playersChip && <span className="badge players-chip">{playersChip}</span>}
            {isTop10 && <span className="top10-badge">TOP 10</span>}
            <GotyBadge awards={game.goty_awards} all />
            {game.review_summary && <span className={`review-badge ${getReviewClass(game.review_summary)}`}>{game.review_summary}</span>}
            {game.category && <span className={`badge-neutral ${badgeClass(game.category)}`}>{game.category}</span>}
            {game.is_early_access && <span className="badge badge-accent">얼리 액세스</span>}
          </>
        }
      />

      <div className="detail-layout">
        {/* 가격 카드 — 데스크톱 오른쪽 위, 좁은 화면에서는 제목 바로 아래 */}
        <aside className="detail-price">
          <div className="price-card">
            <p className="price-card-label">{buyLabel} 가격</p>
            {price && price.discount > 0 && !game.is_free && (
              <p className="price-card-was">
                <span className="buy-discount-badge">-{price.discount}%</span>
                <span className="buy-price-original">{price.formattedOriginal}</span>
              </p>
            )}
            <p className="price-card-now">
              {game.is_free ? '무료'
                : price ? price.formattedFinal
                : game.price_type === 'check_store' && buyUrl
                  ? <a href={buyUrl} target="_blank" rel="noopener noreferrer" className="price-card-store">{PRICE_TYPE_LABEL.check_store} ↗</a>
                  : PRICE_TYPE_LABEL[game.price_type] ?? '가격 정보 없음'}
            </p>
            {timing === 'best' && <span className="lowest-pill">역대 최저가</span>}
            {/* 지금이 역대 최저여도 금액·날짜는 그대로 보여 준다 */}
            {showPriceRecord && game.lowest_price >= 100 && (
              <p className="price-card-lowest">
                역대 최저 <span className="num">₩{Math.round(game.lowest_price).toLocaleString('ko-KR')}</span>
                {formatDate(game.lowest_price_date) && ` · ${formatDate(game.lowest_price_date)}`}
              </p>
            )}
            {timing === 'near' && <LowestPriceBadge timing={timing} />}
            {timingLine && <p className="buy-timing">{timingLine}</p>}
            {buyUrl && (
              <a href={buyUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-lg price-card-buy">
                {buyLabel}에서 {game.is_free ? '플레이하기' : '구매하기'}
              </a>
            )}
            <AddToCompare gameId={game.id} name={game.name} thumb={game.cover_image_url || game.card_image_url} />
            <p className="price-card-note">가격·할인 정보는 실제와 다를 수 있어요. 가격은 하루 한 번 갱신되니 구매 전 스토어에서 확인해 주세요.</p>
          </div>
          {game.discord_url && (
            <a href={game.discord_url} target="_blank" rel="noopener nofollow" className="detail-card discord-card">공식 디스코드 ↗</a>
          )}
        </aside>

        <div className="detail-main">
          {/* 링크 줄 */}
          <div className="detail-links">
            <a href={namuUrl} target="_blank" rel="noopener nofollow" className="detail-link">나무위키 ↗</a>
            <a href={nexusUrl} target="_blank" rel="noopener nofollow" className="detail-link">넥서스 모드 ↗</a>
            <ShareButton variant="text" title={game.name} text={game.fun_description || `${game.name} 같이 할래?`} />
            {platformCategories.length > 0 && (
              <span className="detail-platforms">플랫폼 · {platformCategories.map((c) => CATEGORY_LABEL[c]).join(' · ')}</span>
            )}
          </div>

          {/* 소개 */}
          <section className="detail-card">
            {game.fun_description && <p className="detail-fun">{game.fun_description}</p>}
            {game.description && <p className="detail-description-v2">{game.description}</p>}
            {tagNames.length > 0 && <TagChips tags={tagNames} />}
            <ContentNotice ids={game.content_descriptor_ids} />
          </section>

          {/* 혼자 | 친구랑 | 진입장벽 */}
          <section className="detail-card trio" aria-label="혼자·친구랑·진입장벽">
            <div className="trio-cell">
              <span className="trio-label">혼자</span>
              <span className={`trio-value${game.solo_mode === 'none' || game.solo_playable === false ? ' is-down' : ''}`}>
                {game.solo_mode ? SOLO_LABEL[game.solo_mode] ?? '정보 없음'
                  : game.solo_playable == null ? '정보 없음'
                  : game.solo_playable && game.max_players === 1 ? '싱글 플레이 게임'
                  : game.solo_playable ? '혼자도 가능' : '멀티 전용'}
              </span>
            </div>
            <div className="trio-cell">
              <span className="trio-label">친구랑</span>
              <span className="trio-value trio-big num">
                {friendsMax === 1 ? '같이 하기 없음' : friendsMax ? `최대 ${friendsMax}명` : playersText(game) || '인원 정보 확인 중'}
              </span>
              {game.session_max && <span className="trio-sub num">같은 서버 {game.session_max}명</span>}
              {showHost && <span className="trio-sub">{game.multiplayer_host === 'P2P' ? 'P2P(방장 컴퓨터로 연결)' : game.multiplayer_host}</span>}
              {game.has_crossplay != null && (game.has_online_coop || game.has_pvp) && (
                <span className={`trio-sub${game.has_crossplay ? ' is-on' : ''}`}>{game.has_crossplay ? '크로스플레이 지원' : '크로스플레이 미지원'}</span>
              )}
              {game.recommended_players && <span className="trio-sub">추천 {game.recommended_players}</span>}
            </div>
            <div className="trio-cell">
              <span className="trio-label">진입장벽 <TagHelp tag="진입장벽" /></span>
              <span className="trio-value">{game.entry_barrier || '정보 없음'}</span>
              {game.entry_barrier && game.entry_barrier_reason && <span className="trio-sub">{game.entry_barrier_reason}</span>}
            </div>
          </section>

          {/* 스팀 카드 — 왼쪽 평가, 오른쪽 2×2 */}
          {hasSteamCard && (
            <section className="detail-card steam-card">
              <div className="steam-reviews">
                <h3 className="detail-card-title">Steam 평가</h3>
                {game.review_positive_percent ? (
                  <>
                    <p className="steam-pct">
                      <span className="num">{game.review_positive_percent}%</span>
                      {game.review_summary && <span className={`review-badge ${getReviewClass(game.review_summary)}`}>{game.review_summary}</span>}
                    </p>
                    {game.review_total && <p className="steam-count">전체 리뷰 <span className="num">{game.review_total.toLocaleString('ko-KR')}</span>개</p>}
                    <div className="steam-bar" role="img" aria-label={`긍정 ${game.review_positive_percent}%`}>
                      <span style={{ width: `${game.review_positive_percent}%` }} />
                    </div>
                    {showRecent && (
                      <div className="steam-recent">
                        <p className="steam-recent-head">
                          최근 30일 <span className="num">{recentPct}%</span>
                          <span className="steam-count"> · 리뷰 <span className="num">{game.recent_review_count.toLocaleString('ko-KR')}</span>개</span>
                        </p>
                        <div className="steam-bar is-thin" role="img" aria-label={`최근 30일 긍정 ${recentPct}%`}>
                          <span style={{ width: `${recentPct}%` }} />
                        </div>
                        {Math.abs(recentGap) >= 15 && (
                          <p className={`steam-trend ${recentGap < 0 ? 'is-down' : 'is-up'}`}>{recentGap < 0 ? '최근 평가가 낮아졌어요' : '최근 평가가 좋아졌어요'}</p>
                        )}
                      </div>
                    )}
                  </>
                ) : <p className="steam-count">평가 정보가 아직 없어요</p>}
              </div>
              <div className="steam-grid">
                <div className="steam-cell">
                  <span className="steam-cell-label">ITAD 인기 순위</span>
                  <span className="steam-rank num">{game.heat_rank ? `#${game.heat_rank.toLocaleString('ko-KR')}` : '-'}</span>
                </div>
                <div className="steam-cell">
                  <span className="steam-cell-label">평론가 점수</span>
                  {game.critic_score ? <ScoreRing score={Number(game.critic_score)} /> : <span className="steam-cell-value">-</span>}
                </div>
                <div className="steam-cell">
                  <span className="steam-cell-label">도전과제</span>
                  <span className="steam-cell-value num">{game.achievement_count ? `${game.achievement_count.toLocaleString('ko-KR')}개` : '-'}</span>
                </div>
                <div className="steam-cell">
                  <span className="steam-cell-label">가족 공유 · DLC</span>
                  <span className="steam-cell-value">
                    {game.steam_appid && game.family_sharing != null ? (game.family_sharing ? '공유 가능' : '공유 불가') : '공유 정보 없음'}
                    <br />
                    {game.has_dlc ? 'DLC 있음' : game.has_dlc === false ? 'DLC 없음' : 'DLC 정보 없음'}
                  </span>
                </div>
              </div>
            </section>
          )}

          {/* 게임 정보 가로 한 줄 */}
          <section className="detail-card info-row" aria-label="게임 정보">
            {game.release_date && (
              <div className="info-cell"><span className="info-label">출시일</span><span className="info-value num">{formatDate(game.release_date)}</span></div>
            )}
            {game.last_updated && (() => {
              const st = updateState(game.last_updated);
              return (
                <div className="info-cell">
                  <span className="info-label">마지막 업데이트</span>
                  <span className="info-value num">{formatDate(game.last_updated)}</span>
                  <span className={`info-sub ${st.cls}`}>{st.text}</span>
                </div>
              );
            })()}
            <div className="info-cell">
              <span className="info-label">한국어</span>
              <span className={`info-value${koreanOk ? '' : ' is-down'}`}>
                {!koreanOk ? '지원 안 함' : game.korean_support === '자막+더빙' ? '자막 · 더빙' : '자막 지원'}
              </span>
            </div>
            {game.storage_gb && (
              <div className="info-cell"><span className="info-label">필요 용량</span><span className="info-value num">{game.storage_gb} GB</span></div>
            )}
            {game.developer && (
              <div className="info-cell"><span className="info-label">개발사</span><span className="info-value">{game.developer}</span></div>
            )}
          </section>

          <GameVotes gameId={game.id} />
          {isMulti && <PlayerCountVote gameId={game.id} />}

          {/* 할인 전적 */}
          {showPriceRecord && priceHistory.length === 1 && price && (
            <section className="detail-card is-roomy">
              <h3 className="detail-card-title">할인 전적</h3>
              <p className="detail-card-sub">
                {price.discount > 0
                  ? `지금 ${price.discount}% 할인 중 · ${price.formattedFinal}`
                  : `아직 할인한 적 없어요 · ${price.formattedFinal}`}
              </p>
            </section>
          )}
          {showPriceRecord && priceHistory.length >= 2 && (
            <section className="detail-card is-roomy">
              <h3 className="detail-card-title">할인 전적</h3>
              {timingLine && timingLine !== SAME_AS_LOWEST && <p className="buy-timing is-chart">{timingLine}</p>}
              {/* 기간 기준 시각은 서버에서 정해 넘긴다 (서버·브라우저 계산이 어긋나지 않게) */}
              <DiscountChart history={priceHistory} now={Date.now()} />
            </section>
          )}

          {/* 플레이어 현황 + 더 자세히 */}
          {((game.current_players || game.player_history?.length >= 2) || hasMore) && (
            <div className="detail-two">
              {(game.current_players || game.player_history?.length >= 2) && (
                <section className="detail-card">
                  <h3 className="detail-card-title">플레이어 현황</h3>
                  <div className="player-stats">
                    {game.current_players && (
                      <div className="player-stat-card">
                        <span className="player-stat-label">지금 접속 중</span>
                        <span className="player-stat-num">{game.current_players.toLocaleString('ko-KR')}명</span>
                      </div>
                    )}
                    {game.peak_players && (
                      <div className="player-stat-card">
                        <span className="player-stat-label">역대 최고</span>
                        <span className="player-stat-num">{game.peak_players.toLocaleString('ko-KR')}명</span>
                      </div>
                    )}
                  </div>
                  {game.player_history?.length >= 2 && <PlayerChart data={game.player_history} />}
                  <p className="detail-card-note">Steam 기준 · 매일 자정 갱신</p>
                </section>
              )}
              {hasMore && (
                <section className="detail-card">
                  <h3 className="detail-card-title">더 자세히</h3>
                  <dl className="more-list">
                    {game.has_ending != null && (<><dt>엔딩</dt><dd>{game.has_ending ? '있음' : '없음'}</dd></>)}
                    {game.server_type && (<><dt>서버 방식</dt><dd>{game.server_type}</dd></>)}
                    {game.story_length && (<><dt>클리어까지</dt><dd>{game.story_length}</dd></>)}
                    {game.is_esports && (<><dt>e스포츠</dt><dd>공식 대회 있음</dd></>)}
                    {game.has_workshop && (<><dt>모드 지원</dt><dd>Steam 창작마당</dd></>)}
                    {game.activities?.length > 0 && (
                      <><dt>가능한 활동</dt><dd className="more-chips">{game.activities.map((a: string) => <span key={a} className="activity-chip">{a}</span>)}</dd></>
                    )}
                    {subGenres.length > 0 && (
                      <><dt>장르</dt><dd className="more-chips">{subGenres.map((g) => <span key={g} className="activity-chip">{g}</span>)}</dd></>
                    )}
                  </dl>
                  {game.ending_note && <p className="accordion-note">{game.ending_note}</p>}
                </section>
              )}
            </div>
          )}

          {/* PC 사양 — 접기 (요약에 최소·권장 그래픽카드) */}
          {(minSpec || recSpec) && (
            <details className="detail-card detail-accordion">
              <summary>
                <span className="detail-card-title">PC 사양</span>
                {gpuSummary && <span className="spec-summary">{gpuSummary}</span>}
              </summary>
              <div className="spec-columns">
                {[['최소 사양', minSpec], ['권장 사양', recSpec]].map(([title, rows]) => rows && (
                  <div key={title as string}>
                    <p className="spec-col-title">{title as string}</p>
                    <dl className="more-list">
                      {(rows as { label: string; value: string }[]).map(({ label, value }) => (<Fragment key={label}><dt>{label}</dt><dd>{value}</dd></Fragment>))}
                    </dl>
                  </div>
                ))}
              </div>
            </details>
          )}

          {/* 영상으로 미리 보기 — 하이라이트 + 친구랑 플레이(멀티 게임만) + 스트리머 영상 + 스트리머 채널 */}
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
            streamerVideos={((game.streamer_videos || []) as { video_id: string; title: string; published_at: string; streamer_channels: Ch | Ch[] | null }[]).map((v) => {
              const c = Array.isArray(v.streamer_channels) ? v.streamer_channels[0] : v.streamer_channels;
              return { video_id: v.video_id, title: v.title, published_at: v.published_at, channel_title: c?.channel_title || c?.streamer_name || null };
            })}
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
                      <span className="streamer-name">{s.name} ↗</span>
                      <span className="streamer-platform">{platformLabel}</span>
                    </a>
                  );
                })}
              </div>
            ) : null}
          />

          <GameOpinions gameId={game.id} />
          <RelatedPosts gameId={game.id} />
          {seriesGames && seriesGames.length > 1 && (
            <section className="detail-card series-section">
              <h3 className="detail-card-title">같은 시리즈{series?.name_ko ? ` · ${series.name_ko}` : ''}</h3>
              <ol className="series-list">
                {seriesGames.map((sg) => {
                  const current = sg.id === game.id;
                  const inner = (
                    <>
                      <GameImage src={sg.cover_image_url || sg.card_image_url} steamSize="header_292x136" loading="lazy" alt="" />
                      <span className="series-name">{sg.name}</span>
                    </>
                  );
                  return (
                    <li key={sg.id}>
                      {current ? (
                        <div className="series-item is-current" aria-current="page">{inner}</div>
                      ) : (
                        <Link href={`/games/${sg.id}`} className="series-item">{inner}</Link>
                      )}
                    </li>
                  );
                })}
              </ol>
            </section>
          )}
        </div>
      </div>
    </main>
  );
}