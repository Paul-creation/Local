'use client';

import PosterCard, { posterBadge } from './home/mn/PosterCard';

const SHOW = 6;

// 상세 페이지 하단 "이 게임과 비슷한 게임" — 서버가 점수순 후보 18개를 넘기면(game_similar) 여기서 6장만 보여준다 (메인과 같은 게임 카드 6열)
// 내 PC 사양과는 무관하게 점수순 첫 6장 (사양 등록은 /my-pc에서만 하고, 등록해도 이 목록은 그대로 — 10/9 결정). 후보가 0개면 섹션 자체를 그리지 않는다
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- 게임 카드 칸은 목록(gameIndex)과 같은 느슨한 모양
export default function SimilarGames({ games }: { games: any[] }) {
  const shown = games.slice(0, SHOW);
  if (shown.length === 0) return null;
  return (
    <section className="dx-wide similar-section" aria-labelledby="similar-title">
      <div className="sec-head"><h3 id="similar-title" className="sec-title">이 게임과 비슷한 게임</h3></div>
      <ul className="mn-grid">
        {shown.map((g) => <li key={g.id}><PosterCard game={g} badge={posterBadge(g)} /></li>)}
      </ul>
    </section>
  );
}
