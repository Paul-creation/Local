import { supabase } from './lib/supabase';
import GameGrid from './components/GameGrid';
import { Suspense } from 'react';
import { getHotChart } from './lib/hotChart';
import { getWeeklyFeatured } from './lib/weeklyFeatured';

export const dynamic = 'force-dynamic';

export default async function Home() {
  // 메인(섹션·검색 결과·자동완성·비교 선택·태그 필터)에서 쓰는 칸만 가져온다. 칸을 새로 쓰면 여기에 추가.
  // 가격은 게임마다 최신 원화 1건만 (getPriceInfo와 같은 기준: 100 이상). 전체 기록은 상세 페이지에서.
  // 긴 설명은 이번주의 게임·추천 배너에만 쓰므로 그 게임들만 따로 가져와 합친다.
  // 🔥 지금 뜨는 게임은 메인 select를 늘리지 않고 필요한 게임·기록만 따로 (lib/hotChart)
  // 이번주의 게임도 featured_games에서 그 게임 1개만 따로 (lib/weeklyFeatured). 기록이 없으면 featured 칸으로
  const [{ data: list }, { data: descs }, hot, weekly] = await Promise.all([
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
  ]);
  const descById = new Map((descs || []).map((d) => [d.id, d]));
  const games = (list || []).map((g) => ({ ...g, ...descById.get(g.id) }));

  return (
    <main className="page">
      <Suspense>
        <GameGrid games={games} hotTabs={hot.tabs} top10Ids={hot.top10Ids} weekly={weekly} />
      </Suspense>
      <footer style={{ textAlign: 'center', padding: '40px 0 20px', color: 'var(--text-dimmer)', fontSize: '13px' }}>
        <p style={{ marginBottom: 4, fontWeight: 700, color: 'var(--text-dim)' }}>사이트 이름 미정</p>
        <p>© 2026 The Circles. All rights reserved.</p>
      </footer>
    </main>
  );
}