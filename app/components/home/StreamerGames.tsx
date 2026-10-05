import Link from 'next/link';
import type { StreamerGame } from '../../lib/streamerVideos';
import GameImage from '../GameImage';

// 메인 "스트리머가 플레이한 게임" — 가로 스크롤 한 줄. 카드를 누르면 상세의 스트리머 탭으로 (#streamer-videos)
// 데이터는 page.tsx에서 한 번에 가져옴 (lib/streamerVideos), 게임이 0개면 이 섹션을 그리지 않음
export default function StreamerGames({ games }: { games: StreamerGame[] }) {
  if (!games.length) return null;
  return (
    <section className="home-block" aria-labelledby="streamer-games-title">
      <div className="home-block-head">
        <h2 id="streamer-games-title" className="section-title">스트리머가 플레이한 게임</h2>
      </div>
      <ul className="sg-row">
        {games.map((g) => (
          <li key={g.id} className="sg-item">
            <Link href={`/games/${g.id}#streamer-videos`} className="sg-card">
              <GameImage src={g.image} steamSize="header_292x136" fallbackWidth={480} alt="" loading="lazy" className="sg-img" />
              <span className="sg-name">{g.name}</span>
              <span className="sg-meta">스트리머 {g.streamers}명 플레이</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
