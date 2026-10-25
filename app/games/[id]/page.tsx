import type { Metadata } from 'next';
import { Fragment, type ReactNode } from 'react';
import { supabase } from '../../lib/supabase';
import BackLink from '../../components/BackLink';
import DiscountChart from '../../components/DiscountChart';
import { getPriceInfo, getLowestTiming, PRICE_TYPE_LABEL } from '../../lib/price';
import { isComingSoon, hasDemo, comingSoonLabel, demoStoreUrl } from '../../lib/release';
import { formatDate } from '../../lib/date';
import { lowestGauge } from '../../lib/saleEnds';
import SaleEnds from '../../components/SaleEnds';
import LowestPriceBadge from '../../components/LowestPriceBadge';
import { translateGenres } from '../../lib/genreTranslate';
import { getPlatformCategories, CATEGORY_LABEL } from '../../lib/platformDisplay';
import ReviewRating from '../../components/ReviewRating';
import { reviewTone } from '../../lib/review';
import GameImage from '../../components/GameImage';
import DetailCover from '../../components/detail/DetailCover';
import DetailTrailer from '../../components/detail/DetailTrailer';
import StatTiles, { type Tile } from '../../components/detail/StatTiles';
import AddToCompare from '../../components/AddToCompare';
import HeartButton from '../../components/wishlist/HeartButton';
import { translateTag } from '../../lib/tagTranslate';
import GameVotes from '../../components/GameVotes';
import PlayerCountVote from '../../components/PlayerCountVote';
import { buyTimingLine, SAME_AS_LOWEST } from '../../lib/buyTiming';
import VideoPreviewSection from '../../components/VideoPreviewSection';
import { buildVideoList, type VideoInput } from '../../lib/videoList';
import { tierOf } from '../../lib/streamerPick';
import PcSpecCard from '../../components/pcspec/PcSpecCard';
import ShareButton from '../../components/ShareButton';
import { getTop10Ids } from '../../lib/hotChart';
import { playersText } from '../../lib/players';
import { badgeClass } from '../../lib/badge.mjs';
import GameOpinions from '../../components/community/GameOpinions';
import RelatedPosts from '../../components/community/RelatedPosts';
import { selectGames, mergedTargetOf } from '../../lib/visibleGames';
import ContentNotice from '../../components/ContentNotice';
import TagChips from '../../components/TagChips';
import OwnedChip from '../../components/owned/OwnedChip';
import { detailChipGroups } from '../../lib/tagGroups';
import { buildTree, type TagDict } from '../../lib/tagTree';
import tagDict from '../../lib/tag-search-dict.json';
import { notFound, permanentRedirect } from 'next/navigation';
import { isUuid } from '../../lib/uuid';
import SimilarGames from '../../components/SimilarGames';
import SeriesGames from '../../components/SeriesGames';
import { getCardGames } from '../../lib/gameIndex';
import ActivityChips from '../../components/ActivityChips';
import InfoTip from '../../components/InfoTip';
import ActivityReport from '../../components/ActivityReport';
import { decodeEntities } from '../../lib/htmlEntities';
import { ACTIVITIES, isActivityKey } from '../../lib/activities';
import ScreenshotGallery, { type Screenshot } from '../../components/ScreenshotGallery';
import { gameName } from '../../lib/gameName';
import CuratorsOfGame from '../../components/CuratorsOfGame';
import { getCuratorsOfGame } from '../../lib/curators';

// 게임마다 처음 열릴 때 만들고 1시간 동안 재사용 (ISR). 가격·접속자는 하루 한 번 갱신되므로 충분
// 의견 작성·수정·삭제(api/game-comments)와 신고 자동 숨김(api/community/report)은 그 게임 페이지를 바로 새로 만든다
// 메인 카드의 <Link>가 화면에 보이면 상세를 미리 불러오므로(prefetch) 짧게 잡으면 방문마다 재생성이 몰린다
type Ch = { channel_title: string | null; streamer_name: string; kind: string };
export const revalidate = 3600;
export async function generateStaticParams() {
  return []; // 빌드 때 미리 만들지 않고, 처음 방문할 때 만든다 (빈 배열이어야 ISR이 켜짐)
}

const TAG_TREE = buildTree(tagDict as unknown as TagDict);

// 혼자 플레이 단계 (data/meta/play-modes.json → games.solo_mode)
const SOLO_LABEL: Record<string, string> = { story: '혼자 해도 충분해요', possible: '혼자도 가능', none: '멀티 전용' };

// 이 게임의 태그 번호 — game_tags(투표 순위순). 표가 아직 없거나 비어 있으면 빈 목록(예전 tags 칸으로 대신 표시)
async function getGameTagIds(game: { id: string }) {
  const { data, error } = await supabase.from('game_tags').select('tag_id, rank').eq('game_id', game.id).order('rank');
  return !error && data?.length ? data.map((r) => r.tag_id as number) : [];
}

// 비슷한 게임 후보 — game_similar(태그 득표·확인된 활동 코사인 유사도, 주간 scripts/build-similar-games.mjs). 화면에는 앞 6장만 쓰고 18개를 받아 둔다(나머지는 숨긴 게임이 빠질 때를 대비)
// 표가 아직 없거나 비어 있거나 실패하면 빈 목록 = 섹션 숨김. 숨긴 게임은 getCardGames가 뺀다
const SIMILAR_CANDIDATES = 18;
// 같은 시리즈 게임은 "시리즈" 섹션에 따로 나오므로 후보에서 빼고 다음 순위로 채운다
async function getSimilarGames(gameId: string, excludeIds: string[]) {
  let q = supabase.from('game_similar').select('similar_id').eq('game_id', gameId);
  if (excludeIds.length) q = q.not('similar_id', 'in', `(${excludeIds.join(',')})`);
  const { data, error } = await q.order('rank').limit(SIMILAR_CANDIDATES);
  if (error || !data?.length) return [];
  try { return await getCardGames(data.map((r: { similar_id: string }) => r.similar_id)); } catch { return []; }
}

// 마지막 업데이트로부터 지난 날 → 표시 (30일 안: 활발히 업데이트 중)
function updateState(date: string) {
  const diff = Math.floor((Date.now() - new Date(date).getTime()) / 86400000);
  if (diff < 30) return { cls: 'is-up', text: '활발히 업데이트 중' };
  if (diff < 180) return { cls: '', text: `${Math.floor(diff / 30)}개월 전` };
  return { cls: 'is-down', text: '업데이트 없음' };
}

function parseMinSpec(raw: string | null) {
  if (!raw) return null;
  const lines = decodeEntities(raw).split('/').map((s) => s.trim()).filter(Boolean);
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
  if (!isUuid(id)) notFound();
  const { data: game, error } = await selectGames('name, display_name, description, fun_description, min_players, max_players, difficulty, tags, is_free, price_type, release_status, release_date_text, price_history(price, discount_percent, checked_at, original_price)')
    .eq('id', id)
    .maybeSingle();
  // 조회 오류는 없는 게임(404)과 구분해 던진다 — 일시 오류가 404로 나가 색인에서 빠지면 안 됨
  if (error) throw new Error(`게임 조회 실패(${id}): ${error.message}`);
  if (!game) {
    // 숨긴 중복 게임이면 남긴 게임으로 영구 이동 (메타데이터 단계에서 먼저 처리해야 308 응답이 됨)
    const target = await mergedTargetOf(id);
    if (target) permanentRedirect(`/games/${target}`);
    notFound();
  }

  const players = playersText(game);
  const price = getPriceInfo(game);
  const priceText = isComingSoon(game) ? comingSoonLabel(game) : game.is_free ? '무료' : price ? (price.discount > 0 ? `${price.formattedFinal} (-${price.discount}%)` : price.formattedFinal) : '';
  const summary = [players, game.difficulty, priceText].filter(Boolean).join(' · ');
  const tags = (game.tags || []).slice(0, 3).map((t: string) => '#' + translateTag(t)).join(' ');
  // 한 줄 소개가 있으면 그걸 맨 앞에 (카톡 미리보기에서 제일 먼저 보이는 문장)
  const desc = game.fun_description
    ? [game.fun_description, summary].filter(Boolean).join(' | ')
    : [summary, tags, (game.description || '').replace(/\s+/g, ' ').slice(0, 90)].filter(Boolean).join(' | ');
  const image = `/api/og/game/${id}`;

  return {
    title: summary ? `${gameName(game)} — ${summary}` : gameName(game),
    description: desc,
    alternates: { canonical: `/games/${id}` },
    openGraph: { title: gameName(game), description: desc, url: `/games/${id}`, type: 'website', images: [{ url: image, width: 1200, height: 630 }] },
    twitter: { card: 'summary_large_image', title: gameName(game), description: desc, images: [image] },
  };
}

export default async function GameDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const top10Promise = getTop10Ids().catch(() => [] as string[]);
    const { data: game, error } = await selectGames('*, price_history(price, discount_percent, checked_at, original_price, sale_ends_at), game_streamers(streamer_id, streamers(id, name, platform, handle)), game_videos(kind, video_id, title, channel_title, published_at, view_count), streamer_videos(video_id, title, published_at, view_count, is_short, streamer_channels(channel_title, streamer_name, kind))')
    .order('published_at', { referencedTable: 'streamer_videos', ascending: false })
    .limit(24, { referencedTable: 'streamer_videos' })
    .eq('id', id)
    .maybeSingle();

  if (error) throw new Error(`게임 조회 실패(${id}): ${error.message}`);
  if (!game) {
    const target = await mergedTargetOf(id);
    if (target) permanentRedirect(`/games/${target}`);
    notFound();
  }
  // 같은 시리즈 (series_id가 있을 때만, series_order 순). 숨긴 게임은 selectGames가 뺀다
  const { data: seriesGames } = game.series_id
    ? await selectGames('id').eq('series_id', game.series_id).order('series_order')
    : { data: null };
  const seriesIds: string[] = (seriesGames ?? []).map((g: { id: string }) => g.id);
  const showSeries = seriesIds.length > 1 && seriesIds.includes(game.id);
  const seriesOthers = seriesIds.filter((sid) => sid !== game.id);
  const [top10, tagIds, similarGames, curators, series, seriesCards] = await Promise.all([
    top10Promise, getGameTagIds(game), getSimilarGames(game.id, seriesOthers), getCuratorsOfGame(game.id),
    showSeries ? supabase.from('series').select('name_ko').eq('id', game.series_id).maybeSingle().then((r) => r.data) : null,
    showSeries ? getCardGames(seriesOthers).catch(() => []) : [],
  ]);
  const cardsById = new Map((seriesCards as { id: string }[]).map((g) => [g.id, g]));
  const seriesItems = seriesIds.map((sid) => ({ id: sid, current: sid === game.id, game: cardsById.get(sid) })).filter((it) => it.current || it.game);
  const isTop10 = top10.includes(game.id);
  // 장르는 위쪽 칩에만 둔다 — 소개 아래 태그 줄에서는 뺀다
  const chipGroups = detailChipGroups(TAG_TREE, { ...game, tag_ids: tagIds }, isTop10).filter((g) => g.label !== '장르');
  // 멀티 방식(전용 서버/P2P)은 온라인 협동·대전이 있는 게임만
  const showHost = !!game.multiplayer_host && (game.has_online_coop === true || game.has_pvp === true);
  // 친구랑: 팀 인원(party_max), 없으면 최대 인원 + 같은 서버 인원(session_max)
  const friendsMax = game.party_max ?? game.max_players;
  // 출시 예정 게임은 가격 카드 자리에 출시 예정 안내만 — 가격·할인·역대 최저가·할인 전적은 숨김 (app/lib/release)
  const comingSoon = isComingSoon(game);
  const demo = hasDemo(game);
  const price = comingSoon ? null : getPriceInfo(game);
  // 100원 미만은 잘못 들어온 기록이라 할인 전적에서 제외
  const priceHistory = (game.price_history || []).filter((p: any) => p.price >= 100);
  // 무료·가격 유형 게임(월 구독·판매처에서 확인)은 역대 최저·할인 그래프를 숨김 (기록은 DB에 그대로)
  const showPriceRecord = !comingSoon && !game.is_free && !game.price_type;
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
  // 역대 최저가 게이지 — 정가·현재가·역대 최저가가 모두 있고 앞뒤가 맞을 때만. 아니면 null → 예전 "역대 최저 ..." 줄·문구를 그대로 둔다
  const gauge = showPriceRecord && price && price.discount > 0 ? lowestGauge(price.regular, price.final, game.lowest_price >= 100 ? game.lowest_price : null) : null;
  const lowestDate = formatDate(game.lowest_price_date);
  const isMulti = (game.party_max ?? game.max_players ?? 0) > 1;
  const playersChip = game.max_players === 1 ? '혼자' : playersText(game);
  const hasSteamCard = !!(game.heat_rank || game.achievement_count || (game.steam_appid && game.family_sharing != null) || game.has_dlc != null);
  // 스크린샷 — 주소가 둘 다 있는 것만, 없거나 비면 섹션 숨김
  const shots: Screenshot[] = Array.isArray(game.screenshots)
    ? game.screenshots.filter((s: any) => typeof s?.path_thumbnail === 'string' && typeof s?.path_full === 'string').slice(0, 10)
    : [];
  // 가능한 활동 v2 — 분류표 순서대로 정렬, 둘 다 비면 기존 activities(자유 문구)를 그대로 보여줌
  const orderActivities = (keys: unknown) => {
    const set = new Set(Array.isArray(keys) ? keys.filter(isActivityKey) : []);
    return ACTIVITIES.filter((a) => set.has(a.key)).map((a) => a.label);
  };
  const activityConfirmed = orderActivities(game.activities_confirmed);
  const activityUnsure = orderActivities(game.activities_unsure);
  const hasV2Activities = activityConfirmed.length + activityUnsure.length > 0;
  const hasActivities = hasV2Activities || game.activities?.length > 0;
  const hasMore = game.has_ending != null || game.server_type || hasActivities || game.story_length || game.is_esports || game.has_workshop;

  const heroBg: string | null = game.hero_image_url || shots[0]?.path_full || null;
  const credits = game.developer && game.publisher
    ? (game.developer === game.publisher ? `개발·배급 ${game.developer}` : `개발 ${game.developer} · 배급 ${game.publisher}`)
    : game.developer ? `개발 ${game.developer}` : game.publisher ? `배급 ${game.publisher}` : '';
  // 플레이 시간 — IGDB game_time_to_beats(초). 세 값이 순서대로(빠르게 ≤ 보통 ≤ 완전히)일 때만 쓰고, 멀티 전용 게임은 숨긴다. 칸이 없으면 기존 story_length 문구
  const ttb = game.ttb_normally > 0 && game.solo_mode !== 'none' && (!game.ttb_hastily || game.ttb_hastily <= game.ttb_normally) && (!game.ttb_completely || game.ttb_completely >= game.ttb_normally) ? game : null;
  const hours = (sec: number) => `${Math.max(1, Math.round(sec / 3600)).toLocaleString('ko-KR')}시간`;
  const n = (v: number) => v.toLocaleString('ko-KR');
  const tiles: Tile[] = [];
  if (game.review_positive_percent) tiles.push({ key: 'review', tone: 'review', icon: 'thumb', label: 'Steam 평가', value: <span className="num">{game.review_positive_percent}%</span>, sub: [game.review_summary, game.review_total ? `리뷰 ${n(game.review_total)}개` : ''].filter(Boolean).join(' · ') });
  if (showRecent) tiles.push({ key: 'recent', tone: 'review', icon: 'clock', label: '최근 30일 평가', value: <span className="num">{recentPct}%</span>, sub: Math.abs(recentGap) >= 15 ? (recentGap < 0 ? '최근 평가가 낮아졌어요' : '최근 평가가 좋아졌어요') : `리뷰 ${n(game.recent_review_count)}개` });
  if (game.current_players > 0) tiles.push({ key: 'now', tone: 'live', icon: 'pulse', label: '지금 동접', value: <><span className="num">{n(game.current_players)}</span>명</> });
  if (game.peak_players > 0) tiles.push({ key: 'peak', tone: 'live', icon: 'peak', label: '최고 동접', value: <><span className="num">{n(game.peak_players)}</span>명</>, sub: '역대 기준' });
  if (ttb) tiles.push({ key: 'time', tone: 'time', icon: 'hourglass', label: '플레이 시간', value: <>보통 <span className="num">{hours(ttb.ttb_normally)}</span></>, sub: [ttb.ttb_hastily ? `빠르게 ${hours(ttb.ttb_hastily)}` : '', ttb.ttb_completely ? `전부 ${hours(ttb.ttb_completely)}` : ''].filter(Boolean).join(' · ') || undefined });
  else if (game.story_length && game.solo_mode !== 'none') tiles.push({ key: 'time', tone: 'time', icon: 'hourglass', label: '플레이 시간', value: game.story_length, valueClass: 'is-text' });
  if (friendsMax) tiles.push({ key: 'party', tone: 'party', icon: 'people', label: '인원', value: friendsMax === 1 ? '혼자' : <>최대 <span className="num">{friendsMax}</span>명</> });
  if (game.entry_barrier) tiles.push({ key: 'gate', tone: 'party', icon: 'gate', label: '진입장벽', value: game.entry_barrier, valueClass: 'is-text' });
  tiles.push({ key: 'lang', tone: 'party', icon: 'lang', label: '한국어', value: !koreanOk ? '지원 안 함' : game.korean_support === '자막+더빙' ? '자막 · 더빙' : '자막', valueClass: `is-text${koreanOk ? '' : ' is-down'}` });
  if (!comingSoon) {
    if (showPriceRecord && game.lowest_price >= 100) tiles.push({ key: 'low', tone: 'price', icon: 'low', label: '역대 최저가', value: <span className="num">₩{Math.round(game.lowest_price).toLocaleString('ko-KR')}</span>, sub: timing === 'best' ? '지금이 최저가' : lowestDate || undefined });
  }

  return (
    <main className="page detail-page dx">
      <BackLink fallbackHref="/" label="목록으로" preferList />


      {heroBg && <div className="dx-backdrop" aria-hidden="true"><GameImage src={heroBg} fallbackWidth={1280} alt="" /></div>}

      <header className="dx-head">
        <DetailCover verticalUrl={game.cover_vertical_url ?? null} steamAppid={game.steam_appid ? String(game.steam_appid) : null} fallback={heroImage} name={gameName(game)} />
        <div className="dx-head-info">
          <div className="dx-badges">
            <OwnedChip steamAppid={game.steam_appid} />
            {comingSoon
              ? <span className="badge badge-accent">{comingSoonLabel(game)}</span>
              : <>
                  {game.is_early_access && <span className="badge badge-accent">앞서 해보기</span>}
                  {game.release_date && <span className="badge-neutral">출시 <span className="num">{formatDate(game.release_date)}</span></span>}
                </>}
            {game.category && <span className={`badge-neutral ${badgeClass(game.category)}`}>{game.category}</span>}
          </div>
          <h1 className="dx-title">{gameName(game)}</h1>
          {credits && <p className="dx-credits">{credits}</p>}
          {game.fun_description && <p className="dx-lead">{game.fun_description}</p>}
          {(subGenres.length > 0 || platformCategories.length > 0) && (
            <div className="dx-chips">
              {subGenres.slice(0, 6).map((g) => <span key={g} className="chip">{g}</span>)}
              {platformCategories.map((c) => <span key={c} className="chip">{CATEGORY_LABEL[c]}</span>)}
            </div>
          )}
        </div>
      </header>

      <StatTiles tiles={tiles} />

      <div className="detail-layout">
        {/* 가격 카드 — 데스크톱 오른쪽 위, 좁은 화면에서는 제목 바로 아래 */}
        <aside className="detail-price">
          <div className="price-card">
            {comingSoon ? (
              <>
                <div className="price-card-head">
                  <p className="price-card-label">출시 예정</p>
                  <HeartButton gameId={game.id} variant="title" />
                </div>
                {/* 스팀이 알려 준 출시일 원문 그대로 (날짜 대신 "출시 예정"이 온 경우는 위 제목만) */}
                {comingSoonLabel(game) !== '출시 예정' && <p className="price-card-now">{game.release_date_text}</p>}
                <p className="price-card-lowest">아직 출시 전이라 가격·할인 정보가 없어요</p>
                <div className="price-card-buttons">
                  {demo && (
                    <a href={demoStoreUrl(game.demo_appid)} target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-lg price-card-buy">
                      스팀에서 데모 받기 ↗
                    </a>
                  )}
                  <AddToCompare gameId={game.id} name={gameName(game)} thumb={game.cover_image_url || game.card_image_url} />
                </div>
                <p className="price-card-note">출시일은 스팀 표기 기준이며 바뀔 수 있어요. 출시되면 가격 정보를 보여드려요.</p>
              </>
            ) : (
              <>
            <div className="price-card-head">
              <p className="price-card-label">{buyLabel} 가격</p>
              <HeartButton gameId={game.id} variant="title" />
            </div>
            {price && price.discount > 0 && !game.is_free && (
              <p className="price-card-was">
                <span className="buy-discount-badge">-{price.discount}%</span>
                <span className="buy-price-original">{price.formattedOriginal}</span>
              </p>
            )}
            {price && price.discount > 0 && !game.is_free && <SaleEnds endsAt={price.saleEndsAt} variant="detail" />}
            <p className="price-card-now">
              {game.is_free ? '무료'
                : price ? price.formattedFinal
                : game.price_type === 'check_store' && buyUrl
                  ? <a href={buyUrl} target="_blank" rel="noopener noreferrer" className="price-card-store">{PRICE_TYPE_LABEL.check_store} ↗</a>
                  : PRICE_TYPE_LABEL[game.price_type] ?? '가격 정보 없음'}
            </p>
            {timing === 'best' && <span className="lowest-pill">역대 최저가</span>}
            {/* 지금이 역대 최저여도 금액·날짜는 그대로 보여 준다 */}
            {gauge && (
              <div className="lowest-gauge">
                <div className="lowest-gauge-track" role="img" aria-label={gauge.atLowest ? '역대 최저가와 같아요' : `역대 최저가까지 ${Math.round(100 - gauge.percent)}% 남음`}>
                  <div className="lowest-gauge-bar" style={{ width: `${gauge.percent}%` }} />
                </div>
                <p className="lowest-gauge-text">
                  {gauge.atLowest
                    ? <>역대 최저가와 같아요{lowestDate && ` · ${lowestDate}`}</>
                    : <>역대 최저가까지 <span className="num">₩{gauge.remaining.toLocaleString('ko-KR')}</span> · 역대 최저 <span className="num">₩{Math.round(game.lowest_price).toLocaleString('ko-KR')}</span>{lowestDate && ` (${lowestDate})`}</>}
                </p>
              </div>
            )}
            {!gauge && showPriceRecord && game.lowest_price >= 100 && (
              <p className="price-card-lowest">
                역대 최저 <span className="num">₩{Math.round(game.lowest_price).toLocaleString('ko-KR')}</span>
                {lowestDate && ` (${lowestDate})`}
              </p>
            )}
            {timing === 'near' && <LowestPriceBadge timing={timing} />}
            <div className="price-card-buttons">
              {buyUrl && (
                <a href={buyUrl} target="_blank" rel="noopener noreferrer" className={`btn btn-primary btn-lg price-card-buy${game.steam_appid ? ' is-steam' : ''}`}>
                  {buyLabel}에서 {game.is_free ? '플레이하기' : '구매하기'}
                </a>
              )}
              <AddToCompare gameId={game.id} name={gameName(game)} thumb={game.cover_image_url || game.card_image_url} />
            </div>
            <p className="price-card-note">가격·할인 정보는 실제와 다를 수 있어요. 가격은 하루 한 번 갱신되니 구매 전 스토어에서 확인해 주세요.</p>
              </>
            )}
          </div>
          <CuratorsOfGame items={curators} />
          {game.discord_url && (
            <a href={game.discord_url} target="_blank" rel="noopener nofollow" className="detail-card discord-card">공식 디스코드 ↗</a>
          )}
        </aside>

        <div className="detail-main">
          {game.video_url && <DetailTrailer image={heroBg || heroImage} videoUrl={game.video_url} name={gameName(game)} />}
          {shots.length > 0 && <ScreenshotGallery shots={shots} name={gameName(game)} />}

          {/* 링크 줄 */}
          <div className="detail-links">
            <a href={namuUrl} target="_blank" rel="noopener nofollow" className="detail-link">나무위키 ↗</a>
            <a href={nexusUrl} target="_blank" rel="noopener nofollow" className="detail-link">넥서스 모드 ↗</a>
            <ShareButton variant="text" title={gameName(game)} text={game.fun_description || `${gameName(game)} 같이 할래?`} />
            {platformCategories.length > 0 && (
              <span className="detail-platforms">플랫폼 · {platformCategories.map((c) => CATEGORY_LABEL[c]).join(' · ')}</span>
            )}
          </div>

          {/* 소개 */}
          <section className="detail-card">
            <h3 className="detail-card-title">
              소개
              {game.fun_description && <InfoTip label="AI가 정리한 소개 안내" text="AI가 정리한 소개예요" />}
            </h3>
            {game.fun_description && <p className="detail-fun">{game.fun_description}</p>}
            {game.description && <p className="detail-description-v2">{game.description}</p>}
            {chipGroups.length > 0 && <TagChips groups={chipGroups} />}
            <ContentNotice ids={game.content_descriptor_ids} />
          </section>

          {/* 같이 하기 — 위 타일에 없는 정보만 (혼자 가능 여부·최소 인원·서버·크로스플레이·추천 인원·진입장벽 이유) */}
          {(() => {
            const solo = game.solo_mode ? SOLO_LABEL[game.solo_mode] ?? null
              : game.solo_playable == null ? null
              : game.solo_playable && game.max_players === 1 ? '싱글 플레이 게임'
              : game.solo_playable ? '혼자도 가능' : '멀티 전용';
            const rows: [string, ReactNode][] = [];
            if (solo) rows.push(['혼자', solo]);
            if (game.min_players > 1) rows.push(['최소 인원', <span key="min" className="num">{game.min_players}명</span>]);
            if (game.session_max) rows.push(['같은 서버', <span key="ss" className="num">{game.session_max}명</span>]);
            if (showHost) rows.push(['멀티 방식', game.multiplayer_host === 'P2P' ? 'P2P(방장 컴퓨터로 연결)' : game.multiplayer_host]);
            if (game.has_crossplay != null && (game.has_online_coop || game.has_pvp)) rows.push(['크로스플레이', game.has_crossplay ? '지원' : '미지원']);
            if (game.recommended_players) rows.push(['추천 인원', game.recommended_players]);
            if (game.entry_barrier && game.entry_barrier_reason) rows.push(['진입장벽 이유', game.entry_barrier_reason]);
            if (rows.length === 0) return null;
            return (
              <section className="detail-card" aria-label="같이 하기 정보">
                <h3 className="detail-card-title">같이 하기</h3>
                <dl className="more-list">{rows.map(([k, v]) => <Fragment key={k}><dt>{k}</dt><dd>{v}</dd></Fragment>)}</dl>
              </section>
            );
          })()}

          {/* 스팀 카드 — 왼쪽: 전체 평가(등급·%·리뷰 수·막대) + 최근 30일, 오른쪽: 인기 순위·도전과제·가족 공유·DLC. 헤더는 요약, 여기는 막대가 있는 자세한 평가 */}
          {hasSteamCard && (
            <section className="detail-card steam-card is-solo">
              <div className="steam-grid">
                <div className="steam-cell">
                  <span className="steam-cell-label">ITAD 인기 순위</span>
                  <span className="steam-rank num">{game.heat_rank ? `#${game.heat_rank.toLocaleString('ko-KR')}` : '-'}</span>
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
            {game.storage_gb && (
              <div className="info-cell"><span className="info-label">필요 용량</span><span className="info-value num">{game.storage_gb} GB</span></div>
            )}
          </section>


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

          {/* 더 자세히 */}
          {hasMore && (
            <div className="detail-two">
              {hasMore && (
                <section className="detail-card">
                  <h3 className="detail-card-title">더 자세히</h3>
                  <dl className="more-list">
                    {game.has_ending != null && (<><dt>엔딩</dt><dd>{game.has_ending ? '있음' : '없음'}</dd></>)}
                    {game.server_type && (<><dt>서버 방식</dt><dd>{game.server_type}</dd></>)}
                    {game.story_length && (<><dt>클리어까지</dt><dd>{game.story_length}</dd></>)}
                    {game.is_esports && (<><dt>e스포츠</dt><dd>공식 대회 있음</dd></>)}
                    {game.has_workshop && (<><dt>모드 지원</dt><dd>Steam 창작마당</dd></>)}
                    {hasV2Activities ? (
                      <><dt>가능한 활동</dt><dd className="more-chips"><ActivityChips confirmed={activityConfirmed} unsure={activityUnsure} /></dd></>
                    ) : game.activities?.length > 0 && (
                      <><dt>가능한 활동</dt><dd className="more-chips">{game.activities.map((a: string) => <span key={a} className="activity-chip">{a}</span>)}</dd></>
                    )}
                  </dl>
                  {game.ending_note && <p className="accordion-note">{game.ending_note}</p>}
                  {hasV2Activities && <ActivityReport gameId={game.id} confirmed={game.activities_confirmed || []} unsure={game.activities_unsure || []} />}
                </section>
              )}
            </div>
          )}

          {/* PC 사양 카드 — 내 PC 판정 요약 + 부품별 표 + 원문 사양. 입력한 사양은 브라우저에만 있어서 클라이언트에서 판정. 최소 사양을 하나도 못 읽은 게임(spec_parsed가 없거나 전부 null)은 판정·표 없이 원문만 */}
          {(minSpec || recSpec) && <PcSpecCard parsed={game.spec_parsed} minRows={minSpec} recRows={recSpec} />}

          {/* 영상으로 미리 보기 — 친구랑 플레이(멀티 게임만) + 하이라이트 + 스트리머 영상을 한 목록으로 (순서·자르기: lib/videoList) + 스트리머 채널 */}
          <VideoPreviewSection
            videos={buildVideoList([
              ...((game.game_videos || []) as { kind: string; video_id: string; title: string; channel_title: string | null; published_at: string | null; view_count: number | null }[])
                .filter((v) => v.kind === 'highlight' || (v.kind === 'coop' && game.max_players > 1))
                .map((v): VideoInput => ({ ...v, source: v.kind === 'coop' ? 'coop' : 'highlight' })),
              ...((game.streamer_videos || []) as { video_id: string; title: string; published_at: string; view_count: number | null; is_short: boolean; streamer_channels: Ch | Ch[] | null }[]).flatMap((v): VideoInput[] => {
                const c = Array.isArray(v.streamer_channels) ? v.streamer_channels[0] : v.streamer_channels;
                if (!c) return [];
                return [{ source: 'streamer', video_id: v.video_id, title: v.title, streamer_name: c.streamer_name, tier: tierOf(c.kind, v.is_short), published_at: v.published_at, view_count: v.view_count }];
              }),
            ])}
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
          <div className="dx-votes">
            <GameVotes gameId={game.id} />
            {isMulti && <PlayerCountVote gameId={game.id} />}
          </div>
          {showSeries && seriesItems.length > 1 && <SeriesGames name={series?.name_ko ?? null} currentName={gameName(game)} items={seriesItems} />}
          {similarGames.length > 0 && <SimilarGames games={similarGames} />}
        </div>
      </div>
    </main>
  );
}