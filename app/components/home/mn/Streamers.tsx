// 메인 "스트리머들이 밤새운 협동 게임" — 선정은 lib/streamerTheme (6개 미만이면 theme이 null → 통째로 숨김, 조건에 맞는 게임 전부)
// 16:9 영상 썸네일 카드 한 줄 가로 스크롤(HScrollRow): 썸네일은 첫 스트리머의 대표 영상(YouTube 새 탭), 아래에 겹친 스트리머 아바타 + 게임명(상세 페이지 링크) / 스트리머 이름
// 아바타는 스트리머 채널에 프로필 이미지 칸이 없어 이름 첫 글자로 그린다
import Link from 'next/link';
import { PlayIcon } from './icons';
import HScrollRow from './HScrollRow';
import ThumbImage from './ThumbImage';
import type { StreamerTheme, ThemeGame } from '../../../lib/streamerTheme';

const AVATARS = 3;
const EAGER = 4; // 처음 보이는 카드 4개 외에는 지연 로딩

function Card({ g, eager }: { g: ThemeGame; eager: boolean }) {
  const lead = g.streamers[0];
  const names = g.streamers.map((s) => s.name);
  return (
    <li className="mn-vid">
      <a className="mn-vid-thumb" href={`https://www.youtube.com/watch?v=${lead.videoId}`} target="_blank" rel="noopener noreferrer" aria-label={`${lead.name}의 ${g.name} 영상 보기 (새 탭)`}>
        <ThumbImage videoId={lead.videoId} eager={eager} />
        <span className="mn-play"><PlayIcon /></span>
      </a>
      <div className="mn-vid-body">
        <span className="mn-avatars" aria-hidden="true">
          {names.slice(0, AVATARS).map((n) => <span key={n} className="mn-avatar">{[...n][0]}</span>)}
        </span>
        <span className="mn-vid-text">
          <Link href={`/games/${g.id}`} className="mn-vid-game">{g.name}</Link>
          <span className="mn-vid-by">{names.slice(0, 2).join(', ')}{names.length > 2 ? ` 외 ${names.length - 2}명` : ''}</span>
        </span>
      </div>
    </li>
  );
}

export default function Streamers({ theme }: { theme: StreamerTheme | null }) {
  if (!theme?.games.length) return null;
  return (
    <HScrollRow id="mn-streamer-title" title="스트리머들이 밤새운 협동 게임" label="스트리머 협동 게임 목록" perDesktop={3.3} perMobile={1.2}>
      {theme.games.map((g, i) => <Card key={g.id} g={g} eager={i < EAGER} />)}
    </HScrollRow>
  );
}
