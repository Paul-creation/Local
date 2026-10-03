import { supabase } from './lib/supabase';
import GameGrid from './components/GameGrid';
import { Suspense } from 'react';

export const dynamic = 'force-dynamic';

export default async function Home() {
  // 메인은 게임마다 최신 원화 가격 1건만 쓴다 (getPriceInfo와 같은 기준: 100 이상). 전체 기록은 상세 페이지에서.
  const { data: games } = await supabase
    .from('games')
    .select('*, price_history(price, discount_percent, checked_at, currency)')
    .gte('price_history.price', 100)
    .order('created_at', { ascending: false })
    .order('checked_at', { referencedTable: 'price_history', ascending: false })
    .limit(1, { referencedTable: 'price_history' });

  return (
    <main className="page">
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