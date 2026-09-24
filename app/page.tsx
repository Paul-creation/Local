import { supabase } from './lib/supabase';
import GameGrid from './components/GameGrid';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const { data: games } = await supabase
    .from('games')
    .select('*, price_history(price, discount_percent, checked_at, currency)')
    .order('created_at', { ascending: false });

  const allGames = games || [];

  return (
    <main className="page">
      <nav className="topnav">
        <span className="logo">게임정보허브</span>
      </nav>
      <GameGrid games={allGames} />
    </main>
  );
}