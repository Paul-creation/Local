import { supabase } from './lib/supabase';
import GameGrid from './components/GameGrid';
import { Suspense } from 'react';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const { data: games } = await supabase
    .from('games')
    .select('*, price_history(price, discount_percent, checked_at, currency)')
    .order('created_at', { ascending: false });

  return (
    <main className="page">
      <nav className="topnav">
        <span className="logo">게임정보허브</span>
      </nav>
      <Suspense>
        <GameGrid games={games || []} />
      </Suspense>
      <footer style={{ textAlign: 'center', padding: '40px 0 20px', color: 'var(--text-dimmer)', fontSize: '13px' }}>
        <p style={{ marginBottom: 4, fontWeight: 700, color: 'var(--text-dim)' }}>사이트 이름 미정</p>
        <p>© 2026 The Circles. All rights reserved.</p>
      </footer>
    </main>
  );
}