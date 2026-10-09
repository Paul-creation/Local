import type { StreamerTheme } from '../../lib/streamerTheme';
import StreamerList from './StreamerList';

// 메인 "스트리머들이 밤새운 협동 게임" — 선정은 lib/streamerTheme (6개 미만이면 theme이 null → 통째로 숨김)
// 카드는 메인 공통 카드(GameCard) + 맨 아래 스트리머 배지 줄 — 누르면 상세 페이지 맨 위로, "플레이 영상 보기"는 카드 아래 가장 최근 영상(YouTube)
// 목록 배치(데스크톱 첫 줄 4개 + 더 보기 / 모바일 가로 스크롤)는 StreamerList
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
      <StreamerList games={theme.games} />
    </section>
  );
}
