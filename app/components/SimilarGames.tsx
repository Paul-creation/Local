'use client';

import { useMemo } from 'react';
import ResultCard from './search/ResultCard';
import { useMyPc } from './pcspec/useMyPc';
import { runsOnMyPc } from '../lib/specJudge';
import { toUserPc } from '../lib/myPc';
import { buildTree, type TagDict } from '../lib/tagTree';
import tagDict from '../lib/tag-search-dict.json';

const TREE = buildTree(tagDict as unknown as TagDict);
const SHOW = 4;

// 상세 페이지 하단 "이 게임과 비슷한 게임" — 서버가 점수순 후보를 넉넉히 넘기면(similar_games) 여기서 4장만 보여준다
// 내 PC 사양이 저장돼 있으면 최소 사양 미달인 게임은 빼고 다음 후보로 채운다 (사양은 브라우저에만 있어서 여기서 거름, 판정 문구는 보이지 않음)
// 저장된 값을 읽기 전·미입력이면 거르지 않은 첫 4장. 후보가 0개면 섹션 자체를 그리지 않는다
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- 게임 카드 칸은 목록(gameIndex)과 같은 느슨한 모양
export default function SimilarGames({ games }: { games: any[] }) {
  const { pc } = useMyPc();
  const shown = useMemo(() => {
    const user = pc ? toUserPc(pc) : null;
    return (user ? games.filter((g) => runsOnMyPc(user, g)) : games).slice(0, SHOW);
  }, [games, pc]);
  if (shown.length === 0) return null;
  return (
    <section className="detail-card similar-section" aria-labelledby="similar-title">
      <h3 id="similar-title" className="detail-card-title">이 게임과 비슷한 게임</h3>
      <div className="similar-grid">
        {shown.map((g) => <ResultCard key={g.id} game={g} tree={TREE} />)}
      </div>
    </section>
  );
}
