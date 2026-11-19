'use client';

import { useMemo } from 'react';
import PosterCard, { posterBadge } from '../home/mn/PosterCard';
import SectionHead from '../brand/SectionHead';
import Loader from '../status/Loader';
import { useGameIndex } from '../../lib/useGameIndex';
import { judgePc, type SpecLike, type UserPc } from '../../lib/specJudge';

// 내 PC 결과 — 등록한 사양으로 게임 목록(최소 사양 세 칸만 있음)을 판정해 둘로 나눈다. 6장씩 + 전체 보기
// 시안의 "잘 돌아가요 / 옵션 낮추면 돼요 / 어려워요" 세 단계는 목록에 권장 사양이 없어 나눌 수 없다 — 지금 구분(최소 사양 충족 / 미달)을 그대로 쓴다. 사양을 못 읽은 게임은 어느 쪽에도 넣지 않는다
const SHOW = 6;
type G = { id: string; spec_min?: SpecLike | null; [k: string]: unknown };

export default function MyPcResults({ user }: { user: UserPc }) {
  const { games, error, retry } = useGameIndex();
  const { ok, fail } = useMemo(() => {
    const ok: G[] = [], fail: G[] = [];
    for (const g of (games ?? []) as G[]) {
      if (!g.spec_min) continue;
      const lv = judgePc(user, { min: g.spec_min })?.level;
      if (lv === 'fail') fail.push(g);
      else if (lv) ok.push(g);
    }
    return { ok, fail };
  }, [games, user]);
  if (error) return <p className="mn-note">게임 목록을 불러오지 못했어요 <button type="button" className="btn btn-outline" onClick={retry}>다시 시도</button></p>;
  if (!games) return <Loader />;
  const grid = (list: G[]) => (
    <ul className="mn-grid">
      {list.slice(0, SHOW).map((g, i) => <li key={g.id}><PosterCard game={g} eager={i < 3} badge={posterBadge(g)} /></li>)}
    </ul>
  );
  return (
    <div className="pc-results">
      <section className="mn-sec" aria-labelledby="pcr-ok">
        <SectionHead id="pcr-ok" title="내 PC로 돌아가요" more={{ href: '/?mypc=1', text: '전체 보기', hard: true }} />
        {ok.length > 0 ? grid(ok) : <p className="mn-note">최소 사양을 충족하는 게임이 아직 없어요</p>}
      </section>
      <section className="mn-sec" aria-labelledby="pcr-fail">
        <SectionHead id="pcr-fail" title="내 PC로는 어려워요" />
        {fail.length > 0 ? grid(fail) : <p className="mn-note">최소 사양에 못 미치는 게임이 없어요</p>}
        <p className="mn-note">판정은 최소 사양 기준이에요. 권장 사양까지는 각 게임 페이지에서 확인할 수 있어요.</p>
      </section>
    </div>
  );
}
