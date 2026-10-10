import { supabase } from './lib/supabase';
import GameGrid from './components/GameGrid';
import HomeEvent from './components/home/HomeEvent';
import HomeSections from './components/home/HomeSections';
import type { Metadata } from 'next';
import { BASE_OG, SITE_NAME, SITE_ALT_NAMES, SITE_URL, SITE_TITLE, SITE_META_DESCRIPTION } from './lib/site';
import { getHotChart } from './lib/hotChart';
import { getWeeklyFeatured } from './lib/weeklyFeatured';
import { getPopularPosts } from './lib/community';
import { flattenGame } from './lib/price';
import { HOME_FILTER_STYLE_ID } from './lib/homeFilter';
import { GUIDE_RESERVE_SCRIPT } from './lib/guideStrip';
import { getStreamerNamesByGame } from './lib/streamerVideos';
import { getStreamerTheme } from './lib/streamerTheme';
import { selectHomeGames } from './lib/visibleGames';
import { getPeopleRecs, getHomeExcludedIds } from './lib/peopleRecs';

// 5분마다 새로 만든 결과를 모두에게 보여준다 (방문마다 DB를 조회하지 않도록). 인기 글·가격도 최대 5분 늦게 반영
export const revalidate = 300;
export const metadata: Metadata = {
  alternates: { canonical: '/' },
  openGraph: { ...BASE_OG, title: SITE_TITLE, description: SITE_META_DESCRIPTION, url: '/' },
};

// 구조화 데이터(WebSite) — 검색 결과의 사이트 이름 표시용
const websiteJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: SITE_NAME,
  alternateName: SITE_ALT_NAMES,
  url: SITE_URL + '/',
  description: SITE_META_DESCRIPTION,
  inLanguage: 'ko',
};

// 이번주의 게임(기록이 없을 때 featured 칸)에 쓰는 칸 — 그 게임만 가져온다
const SECTION_FIELDS = `
  id, name, tags, difficulty, min_players, max_players, is_free, price_type, lowest_price,
  card_image_url, cover_image_url, description, fun_description, featured, category, goty_awards,
  price_history(price, discount_percent, checked_at, currency, original_price, sale_ends_at)
`;

// 필터가 담긴 주소(/?sale=1, /?r=1&p=… 등)로 들어오면, React가 그리기 전 첫 HTML에서 홈 섹션을 숨기고 로딩 막대를 보여준다
// (홈 화면이 잠깐 보였다가 결과로 바뀌는 깜빡임 방지). useGameFilters가 주소를 읽은 뒤 이 스타일을 지운다
const HOME_FILTER_SCRIPT = `(function(){try{if(/[?&](r|q|cat|tags|ex|barrier|story|net|p|d|free|sale|cmp|players|price|solo)=/.test(location.search)){var s=document.createElement('style');s.id='${HOME_FILTER_STYLE_ID}';s.textContent='.home-only{display:none!important}.home-url-skel{display:block!important}';document.head.appendChild(s)}}catch(e){}})();`;

export default async function Home() {
  // 전체 게임 목록은 여기서 보내지 않는다 — 검색·필터용 목록은 첫 화면 뒤에 /api/games/list로 따로 받음 (lib/gameIndex)
  // 🔥 지금 뜨는 게임(lib/hotChart)·이번주의 게임(lib/weeklyFeatured)·인기 게시물(최근 7일 추천+댓글 순 5개)은 필요한 것만 따로
  // 긴 설명(description)은 짧은 소개(fun_description)가 없을 때만 화면에 쓰이므로 그때만 남긴다
  const [{ data: sectionRows }, hot, weekly, popularPosts] = await Promise.all([
    selectHomeGames(SECTION_FIELDS) // 메인 노출 제외 게임은 추천에서 빠짐
      .eq('featured', true)
      .gte('price_history.price', 100)
      .order('created_at', { ascending: false })
      .order('checked_at', { referencedTable: 'price_history', ascending: false })
      .limit(1, { referencedTable: 'price_history' }),
    getHotChart().catch(() => ({ tabs: [], top10Ids: [] as string[] })),
    getWeeklyFeatured().catch(() => null),
    getPopularPosts().catch(() => []),
  ]);

  // 지금 뜨는 게임에 보이는 게임들의 스트리머를 한 번에 읽어 붙인다 (실패해도 배지만 빠짐)
  const names = await getStreamerNamesByGame([...new Set(hot.tabs.flatMap((t) => t.items.map((i) => i.id)))]).catch(() => new Map<string, string[]>());
  const hotTabs = hot.tabs.map((t) => ({ ...t, items: t.items.map((i) => ({ ...i, streamers: names.get(i.id) ?? [] })) }));

  // 인원별 추천 — 지금 뜨는 게임(모든 탭 1~3위)과 겹치는 건 뺀다. 실패하면 줄만 빠짐
  const hotTop3 = [...new Set(hot.tabs.flatMap((t) => t.items.slice(0, 3).map((i) => i.id)))];
  const [peopleRecs, homeExcluded] = await Promise.all([getPeopleRecs(hotTop3).catch(() => null), getHomeExcludedIds().catch(() => [] as string[])]);

  const rows = (sectionRows || []).map((g) => flattenGame({ ...g, description: g.fun_description ? null : g.description }));
  const featured: Record<string, any> | null = weekly || rows.find((g) => g.featured) || null;

  // 스트리머 협동은 위 섹션(인원별 추천 4종 전부·지금 뜨는 게임 탭들의 1~10위·이번주의 게임)에 나온 게임을 먼저 빼고 고른다 (기준 미달이면 lib 안에서 중복 제거 없이 다시 고름)
  const shownAbove = [
    ...(peopleRecs ? Object.values(peopleRecs.ids).flat() : []),
    ...hot.tabs.flatMap((t) => t.items.map((i) => i.id)),
    ...(featured ? [featured.id as string] : []),
  ];
  const streamerTheme = await getStreamerTheme(shownAbove).catch(() => null);

  return (
    <main className="page">
      <script dangerouslySetInnerHTML={{ __html: HOME_FILTER_SCRIPT }} />
      {/* 안내 띠를 아직 안 닫은 사람에게만 띠 자리를 첫 그림 전에 잡아 둔다 (채워질 때 레이아웃이 밀리지 않게, lib/guideStrip) */}
      <script dangerouslySetInnerHTML={{ __html: GUIDE_RESERVE_SCRIPT }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd).replace(/</g, '\\u003c') }} />
      <GameGrid
        peopleReady={!!peopleRecs}
        event={<HomeEvent />}
        sections={<HomeSections featured={featured} hotTabs={hotTabs} popularPosts={popularPosts} streamerTheme={streamerTheme} peopleRecs={peopleRecs} homeExcluded={homeExcluded} />}
        top10Ids={hot.top10Ids}
      />
    </main>
  );
}
