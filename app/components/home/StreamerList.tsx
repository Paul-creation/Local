'use client';

import { useState } from 'react';
import type { ThemeGame } from '../../lib/streamerTheme';
import GameCard from './GameCard';
import StreamerBadge from './StreamerBadge';

// 스트리머 협동 카드 목록 — 900px 이상에서는 첫 줄 4개만 보이고 "더 보기"로 12개까지 펼친다 (접힘은 CSS .is-collapsed, 지금 뜨는 게임과 같은 패턴)
// 900px 미만에서는 접지 않고 가로 한 줄로 밀어 넘긴다 (인원별 추천과 같은 가로 스크롤)
// 게임이 6개뿐이면 4칸 격자에서 마지막 줄이 비어 보이므로 데스크톱은 4개만 보이고 "더 보기" 버튼도 없다 (모바일 가로 줄에는 6개 다 있음)
const EXPAND_MIN = 7;

export default function StreamerList({ games }: { games: ThemeGame[] }) {
  const [open, setOpen] = useState(false);
  const canExpand = games.length >= EXPAND_MIN;
  return (
    <>
      <ul className={`sg-grid${open && canExpand ? '' : ' is-collapsed'}`} id="sg-grid">
        {games.map((g) => (
          <li key={g.id} className="sg-item">
            <GameCard game={g.game} className="sg-card">
              <StreamerBadge names={g.streamers} max={2} />
            </GameCard>
            {g.videoId && <a href={`https://www.youtube.com/watch?v=${g.videoId}`} target="_blank" rel="noopener noreferrer" className="sg-video">플레이 영상 보기</a>}
          </li>
        ))}
      </ul>
      {canExpand && (
        <button type="button" className="btn btn-outline sg-more" aria-expanded={open} aria-controls="sg-grid" onClick={() => setOpen((v) => !v)}>
          {open ? '접기' : '더 보기'}
        </button>
      )}
    </>
  );
}
