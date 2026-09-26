import { supabase } from '../lib/supabase';
import GameGrid from '../components/GameGrid';

export const dynamic = 'force-dynamic';

export default async function BrowsePage() {
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
      <a href="/" style={{
        display: 'inline-block', marginBottom: 20,
        fontSize: 14, color: 'var(--accent)', fontWeight: 700, textDecoration: 'none',
      }}>
        ← 홈으로
      </a>
      <GameGrid games={allGames} hideHero={true} />
      <footer style={{
        textAlign: 'center',
        padding: '40px 0 20px',
        color: 'var(--text-dimmer)',
        fontSize: '13px',
      }}>
        <p>© 2026 The Circles. All rights reserved.</p>
      </footer>
    </main>
  );
}