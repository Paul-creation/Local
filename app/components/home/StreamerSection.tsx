import type { StreamerTheme } from '../../lib/streamerTheme';
import GameCard from './GameCard';
import StreamerBadge from './StreamerBadge';

// 메인 "스트리머들이 밤새운 협동 게임" — 선정은 lib/streamerTheme (6개 미만이면 theme이 null → 통째로 숨김)
// 카드는 메인 공통 카드(GameCard) + 맨 아래 스트리머 배지 줄 — 누르면 상세 페이지 맨 위로, "플레이 영상 보기"는 카드 아래 가장 최근 영상(YouTube)
export default function StreamerSection({ theme }: { theme: StreamerTheme | null }) {
  if (!theme?.games.length) return null;
  return (
    <section className="home-block" aria-labelledby="streamer-games-title">
      <div className="home-block-head">
        <div>
          <h2 id="streamer-games-title" className="section-title">스트리머들이 밤새운 협동 게임</h2>
          <p className="section-sub">스트리머가 직접 플레이한 협동 게임 모음</p>
        </div>
      </div>
      <ul className="sg-grid">
        {theme.games.map((g) => (
          <li key={g.id} className="sg-item">
            <GameCard game={g.game} className="sg-card">
              <StreamerBadge names={g.streamers} max={2} />
            </GameCard>
            {g.videoId && <a href={`https://www.youtube.com/watch?v=${g.videoId}`} target="_blank" rel="noopener noreferrer" className="sg-video">플레이 영상 보기</a>}
          </li>
        ))}
      </ul>
    </section>
  );
}
