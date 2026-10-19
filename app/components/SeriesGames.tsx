'use client';

import ResultCard from './search/ResultCard';
import { buildTree, type TagDict } from '../lib/tagTree';
import tagDict from '../lib/tag-search-dict.json';

const TREE = buildTree(tagDict as unknown as TagDict);

// 상세 "{시리즈} 시리즈" — series_order 순, 카드는 "이 게임과 비슷한 게임"과 같은 컴포넌트
// 지금 보는 게임은 카드 대신 "지금 보는 게임" 칸(링크 없음). 서버가 시리즈 게임이 2개 이상일 때만 그린다
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- 게임 카드 칸은 목록(gameIndex)과 같은 느슨한 모양
export default function SeriesGames({ name, currentName, items }: { name: string | null; currentName: string; items: { id: string; current: boolean; game?: any }[] }) {
  return (
    <section className="detail-card series-section" aria-labelledby="series-title">
      <h3 id="series-title" className="detail-card-title">{name ? `${name} 시리즈` : '같은 시리즈'}</h3>
      <div className="similar-grid">
        {items.map((it) => it.current ? (
          <div key={it.id} className="series-current" aria-current="page">
            <span className="series-current-label">지금 보는 게임</span>
            <span className="series-current-name">{currentName}</span>
          </div>
        ) : <ResultCard key={it.id} game={it.game} tree={TREE} compact />)}
      </div>
    </section>
  );
}
