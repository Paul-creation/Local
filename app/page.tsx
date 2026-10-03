import { supabase } from './lib/supabase';
import GameGrid from './components/GameGrid';
import { Suspense } from 'react';
import type { Metadata } from 'next';
import { BASE_OG, SITE_NAME, SITE_DESCRIPTION } from './lib/site';
import { getHotChart } from './lib/hotChart';
import { getWeeklyFeatured } from './lib/weeklyFeatured';
import { getPopularPosts } from './lib/community';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  alternates: { canonical: '/' },
  openGraph: { ...BASE_OG, title: SITE_NAME, description: SITE_DESCRIPTION, url: '/' },
};

export default async function Home() {
  // 메인(섹션·검색 결과·자동완성·비교 선택·태그 필터)에서 쓰는 칸만 가져온다. 칸을 새로 쓰면 여기에 추가.
  // 가격은 게임마다 최신 원화 1건만 (getPriceInfo와 같은 기준: 100 이상). 전체 기록은 상세 페이지에서.
  // 긴 설명은 이번주의 게임·추천 배너에만 쓰므로 그 게임들만 따로 가져와 합친다.
  // 🔥 지금 뜨는 게임은 메인 select를 늘리지 않고 필요한 게임·기록만 따로 (lib/hotChart)
  // 이번주의 게임도 featured_games에서 그 게임 1개만 따로 (lib/weeklyFeatured). 기록이 없으면 featured 칸으로
  // 인기 게시물: 최근 7일 추천+댓글 순 5개, 모자라면 최근 글로 채움
  const [{ data: list }, { data: descs }, hot, weekly, popularPosts] = await Promise.all([
    supabase
      .from('games')
      .select(`
        id, name, search_name_ko, tags, category, difficulty,
        min_players, max_players, recommended_players, solo_playable,
        is_free, lowest_price, steam_appid, source, cover_image_url, card_image_url,
        featured, is_casual_party, heat_rank,
        price_history(price, discount_percent, checked_at, currency)
      `)
      .gte('price_history.price', 100)
      .order('created_at', { ascending: false })
      .order('checked_at', { referencedTable: 'price_history', ascending: false })
      .limit(1, { referencedTable: 'price_history' }),
    supabase
      .from('games')
      .select('id, description, fun_description')
      .or('featured.eq.true,is_casual_party.eq.true'),
    getHotChart().catch(() => ({ tabs: [], top10Ids: [] as string[] })),
    getWeeklyFeatured().catch(() => null),
    getPopularPosts().catch(() => []),
  ]);
  const descById = new Map((descs || []).map((d) => [d.id, d]));
  const games = (list || []).map((g) => ({ ...g, ...descById.get(g.id) }));

  return (
    <main className="page">
      <Suspense>
        <GameGrid games={games} hotTabs={hot.tabs} top10Ids={hot.top10Ids} weekly={weekly} popularPosts={popularPosts} />
      </Suspense>
    </main>
  );
}