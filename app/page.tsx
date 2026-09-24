import { supabase } from './lib/supabase';
import GameGrid from './components/GameGrid';
import DiscountSection from './components/DiscountSection';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const { data: games } = await supabase
    .from('games')
    .select('*, price_history(price, discount_percent, checked_at, currency)')
    .order('created_at', { ascending: false });

  const allGames = games || [];
  const freeGames = allGames.filter((g) => g.is_free);

  return (
    <main className="page">
      <nav className="topnav">
        <span className="logo">게임정보허브</span>
      </nav>

      {/* 1. 히어로 + 추천 배너 (GameGrid 안에 있음) */}
      <GameGrid games={allGames} />
    </main>
  );
}