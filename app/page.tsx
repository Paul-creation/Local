import { supabase } from './lib/supabase';
import GameGrid from './components/GameGrid';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const { data: games, error } = await supabase
    .from('games')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    return <div className="page">에러: {error.message}</div>;
  }

  return (
    <main className="page">
      <nav className="topnav">
        <span className="logo">게임정보허브</span>
      </nav>
      <GameGrid games={games} />
    </main>
  );
}