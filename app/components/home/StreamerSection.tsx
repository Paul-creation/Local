import Link from 'next/link';
import type { StreamerTheme } from '../../lib/streamerTheme';
import GameImage from '../GameImage';
import StreamerBadge from './StreamerBadge';

// 메인 "스트리머들이 밤새운 협동 게임" — 선정은 lib/streamerTheme (6개 미만이면 theme이 null → 통째로 숨김)
// 카드를 누르면 일반 게임 카드처럼 상세 페이지 맨 위로, "플레이 영상 보기"는 가장 최근 영상(YouTube)
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
            <Link href={`/games/${g.id}`} className="sg-card">
              <GameImage src={g.image} steamSize="header_292x136" fallbackWidth={480} alt="" loading="lazy" className="sg-img" />
              <span className="sg-name">{g.name}</span>
            </Link>
            <StreamerBadge names={g.streamers} max={2} />
            {g.videoId && <a href={`https://www.youtube.com/watch?v=${g.videoId}`} target="_blank" rel="noopener noreferrer" className="sg-video">플레이 영상 보기</a>}
          </li>
        ))}
      </ul>
    </section>
  );
}
