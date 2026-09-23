import { supabase } from './lib/supabase';
import GameGrid from './components/GameGrid';
import DiscountSection from './components/DiscountSection';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const { data: games } = await supabase
    .from('games')
    .select('*, price_history(price, discount_percent, checked_at)')
    .order('created_at', { ascending: false });

  const allGames = games || [];
  const discountedGames = allGames.filter(
    (g) => !g.is_free && g.price_history?.some((p: any) => p.discount_percent > 0)
  );
  const freeGames = allGames.filter((g) => g.is_free);

  return (
    <main className="page">
      <nav className="topnav">
        <span className="logo">게임정보허브</span>
      </nav>
      {discountedGames.length > 0 && (
        <DiscountSection games={discountedGames} />
      )}
      {freeGames.length > 0 && (
        <section className="free-section">
          <div className="section-header">
            <h2 className="section-title">🆓 지금 무료로 즐길 수 있는 게임</h2>
            <span className="section-sub">설치만 하면 바로 친구랑 시작 가능</span>
          </div>
          <div className="free-strip">
            {freeGames.slice(0, 6).map((g) => (
              <a href={`/games/${g.id}`} key={g.id} className="free-chip">
                <img src={g.cover_image_url} alt={g.name} />
                <span>{g.name}</span>
              </a>
            ))}
          </div>
        </section>
      )}
      <GameGrid games={allGames} />
    </main>
  );
}