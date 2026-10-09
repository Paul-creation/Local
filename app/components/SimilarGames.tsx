'use client';

import ResultCard from './search/ResultCard';
import { buildTree, type TagDict } from '../lib/tagTree';
import tagDict from '../lib/tag-search-dict.json';

const TREE = buildTree(tagDict as unknown as TagDict);
const SHOW = 4;

// 상세 페이지 하단 "이 게임과 비슷한 게임" — 서버가 점수순 후보를 넉넉히 넘기면(similar_games) 여기서 4장만 보여준다
// 내 PC 사양과는 무관하게 점수순 첫 4장 (사양 등록은 /my-pc에서만 하고, 등록해도 이 목록은 그대로). 후보가 0개면 섹션 자체를 그리지 않는다
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- 게임 카드 칸은 목록(gameIndex)과 같은 느슨한 모양
export default function SimilarGames({ games }: { games: any[] }) {
  const shown = games.slice(0, SHOW);
  if (shown.length === 0) return null;
  return (
    <section className="detail-card similar-section" aria-labelledby="similar-title">
      <h3 id="similar-title" className="detail-card-title">이 게임과 비슷한 게임</h3>
      <div className="similar-grid">
        {shown.map((g) => <ResultCard key={g.id} game={g} tree={TREE} compact />)}
      </div>
    </section>
  );
}
