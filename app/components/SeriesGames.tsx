'use client';

import PosterCard, { posterBadge } from './home/mn/PosterCard';
import { BracketCorners } from './brand/SelectBrackets';

// 상세 "{시리즈} 시리즈" — series_order 순, 카드는 메인과 같은 게임 카드(PosterCard) 6열. 지금 보는 게임은 링크 없는 카드 하나에만 괄호 + "지금 보는 게임" 라벨
// 서버가 시리즈 게임이 2개 이상일 때만 그린다
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- 게임 카드 칸은 목록(gameIndex)과 같은 느슨한 모양
export default function SeriesGames({ name, currentName, currentGame, items }: { name: string | null; currentName: string; currentGame: any; items: { id: string; current: boolean; game?: any }[] }) {
  return (
    <section className="dx-wide series-section" aria-labelledby="series-title">
      <div className="sec-head"><h3 id="series-title" className="sec-title">{name ? `${name} 시리즈` : '같은 시리즈'}</h3></div>
      <ul className="mn-grid">
        {items.map((it) => it.current ? (
          <li key={it.id} aria-current="page" className="series-current-item">
            <span className="series-current-label">지금 보는 게임</span>
            <div className="mn-card">
              <span className="mn-poster sb-host">
                <PosterCardImage game={currentGame} />
                <BracketCorners size="poster" on />
              </span>
              <span className="mn-card-name">{currentName}</span>
            </div>
          </li>
        ) : <li key={it.id}><PosterCard game={it.game} badge={posterBadge(it.game)} /></li>)}
      </ul>
    </section>
  );
}

import PosterImage from './home/mn/PosterImage';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function PosterCardImage({ game }: { game: any }) {
  return <PosterImage cover={{ vertical: game.cover_vertical_url ?? null, appid: game.steam_appid ?? null, wide: game.card_image_url || game.cover_image_url || null }} />;
}
