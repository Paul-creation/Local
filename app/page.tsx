import { supabase } from './lib/supabase';

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
      <div className="header">
        <h1>임시제목임</h1>
        <p>친구들이랑 하기 좋은 바이럴 게임, 한눈에</p>
      </div>
      <div className="grid">
        {games.map((game) => (
          <div key={game.id} className="card">
            <div className="card-image-wrap">
              <img src={game.cover_image_url} alt={game.name} />
              {game.platform?.[0] && (
                <span className="platform-badge">{game.platform[0]}</span>
              )}
            </div>
            <div className="card-body">
              <h3>{game.name}</h3>
              <p style={{ color: 'var(--text-dim)', fontSize: 13, margin: '6px 0 0' }}>
                {game.min_players && game.max_players
                  ? `${game.min_players}-${game.max_players}인`
                  : ''}
                {game.difficulty ? ` · ${game.difficulty}` : ''}
              </p>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}