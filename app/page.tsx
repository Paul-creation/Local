import { supabase } from './lib/supabase';
import GameGrid from './components/GameGrid';
import HomeEvent from './components/home/HomeEvent';
import HomeSections from './components/home/HomeSections';
import type { Metadata } from 'next';
import { BASE_OG, SITE_NAME, SITE_DESCRIPTION } from './lib/site';
import { getHotChart } from './lib/hotChart';
import { getWeeklyFeatured } from './lib/weeklyFeatured';
import { getPopularPosts } from './lib/community';
import { flattenGame } from './lib/price';
import { TAG_GROUPS } from './lib/tagGroups';
import { HOME_FILTER_STYLE_ID } from './lib/homeFilter';

// 5분마다 새로 만든 결과를 모두에게 보여준다 (방문마다 DB를 조회하지 않도록). 인기 글·가격도 최대 5분 늦게 반영
export const revalidate = 300;
export const metadata: Metadata = {
  alternates: { canonical: '/' },
  openGraph: { ...BASE_OG, title: SITE_NAME, description: SITE_DESCRIPTION, url: '/' },
};

// 이번주의 게임(기록이 없을 때 featured 칸)·추천 배너에 쓰는 칸 — 그 게임들만 가져온다
const SECTION_FIELDS = `
  id, name, tags, difficulty, min_players, max_players, is_free, lowest_price,
  card_image_url, cover_image_url, description, fun_description, featured, is_casual_party,
  price_history(price, discount_percent, checked_at, currency)
`;

// 필터가 담긴 주소(/?sale=1, /?r=1&p=… 등)로 들어오면, React가 그리기 전 첫 HTML에서 홈 섹션을 숨기고 로딩 막대를 보여준다
// (홈 화면이 잠깐 보였다가 결과로 바뀌는 깜빡임 방지). useGameFilters가 주소를 읽은 뒤 이 스타일을 지운다
const HOME_FILTER_SCRIPT = `(function(){try{if(/[?&](r|q|cat|tags|p|d|free|sale|cmp|players)=/.test(location.search)){var s=document.createElement('style');s.id='${HOME_FILTER_STYLE_ID}';s.textContent='.home-only{display:none!important}.home-url-skel{display:block!important}';document.head.appendChild(s)}}catch(e){}})();`;

export default async function Home() {
  // 전체 게임 목록은 여기서 보내지 않는다 — 검색·필터용 목록은 첫 화면 뒤에 /api/games/list로 따로 받음 (lib/gameIndex)
  // 🔥 지금 뜨는 게임(lib/hotChart)·이번주의 게임(lib/weeklyFeatured)·인기 게시물(최근 7일 추천+댓글 순 5개)은 필요한 것만 따로
  // 태그 선택 칸은 DB에 실제로 있는 태그만 보여주므로 태그 이름만 모아서 넘긴다
  // 긴 설명(description)은 짧은 소개(fun_description)가 없을 때만 화면에 쓰이므로 그때만 남긴다
  const [{ data: sectionRows }, { data: tagRows }, hot, weekly, popularPosts] = await Promise.all([
    supabase
      .from('games')
      .select(SECTION_FIELDS)
      .or('featured.eq.true,is_casual_party.eq.true')
      .gte('price_history.price', 100)
      .order('created_at', { ascending: false })
      .order('checked_at', { referencedTable: 'price_history', ascending: false })
      .limit(1, { referencedTable: 'price_history' }),
    supabase.from('games').select('tags'),
    getHotChart().catch(() => ({ tabs: [], top10Ids: [] as string[] })),
    getWeeklyFeatured().catch(() => null),
    getPopularPosts().catch(() => []),
  ]);

  const rows = (sectionRows || []).map((g) => flattenGame({ ...g, description: g.fun_description ? null : g.description }));
  const featured: Record<string, any> | null = weekly || rows.find((g) => g.featured) || null;
  const bannerPool = rows.filter((g) => g.is_casual_party && !g.featured && g.id !== featured?.id);

  const groupTags = new Set(Object.values(TAG_GROUPS).flat());
  const presentTags = [...new Set((tagRows || []).flatMap((g) => (g.tags as string[] | null) || []))].filter((t) => groupTags.has(t));

  return (
    <main className="page">
      <script dangerouslySetInnerHTML={{ __html: HOME_FILTER_SCRIPT }} />
      <GameGrid
        event={<HomeEvent />}
        sections={<HomeSections featured={featured} bannerPool={bannerPool} hotTabs={hot.tabs} popularPosts={popularPosts} />}
        presentTags={presentTags}
        top10Ids={hot.top10Ids}
      />
    </main>
  );
}
