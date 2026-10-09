'use client';

import { useEffect, useMemo, useState } from 'react';
import ResultCard from '../search/ResultCard';
import { useWishlist } from '../wishlist/useWishlist';
import { useMyPc } from '../pcspec/useMyPc';
import { useGameIndex } from '../../lib/useGameIndex';
import { supabase } from '../../lib/supabase';
import { toUserPc } from '../../lib/myPc';
import { runsOnMyPc } from '../../lib/specJudge';
import { PEOPLE_SHOW, type CardGame } from '../../lib/peopleRecs';
import { getCardExtras } from '../../lib/cardExtras';
import type { CardExtras } from '../../lib/cardInfo';
import { usePeople } from './PeopleContext';

// 메인 "찜한 게임과 비슷한 게임" — 찜목록(localStorage)이 있을 때만. 가장 최근에 찜한 3개마다 similar_games(상세 "비슷한 게임"과 같은 함수)를 불러
// 점수를 합치고, 찜한 게임 자체는 뺀 뒤 상위 3개를 보여준다. 카드는 메인 검색용 전체 목록(useGameIndex, 이미 받아 둔 것)에서 가져온다
// 메인 노출 제외 게임(homeExcluded)은 뺀다. 내 PC 토글이 켜져 있으면 최소 사양 미달도 뺀다. 못 가져오면 줄 자체를 숨김
const SEEDS = 3;
const CANDIDATES = 12;
type Row = { game_id: string; score: number };

export default function WishlistRecs({ homeExcluded }: { homeExcluded: string[] }) {
  const { ids, ready } = useWishlist();
  const { myPcOn } = usePeople();
  const { pc, ready: pcReady } = useMyPc();
  const { games: index } = useGameIndex();
  const seeds = useMemo(() => ids.slice(-SEEDS), [ids]);
  const seedKey = seeds.join(',');
  const [scored, setScored] = useState<{ key: string; rows: Row[] } | null>(null);

  useEffect(() => {
    if (!seedKey) return;
    let alive = true;
    Promise.all(seedKey.split(',').map((id) => supabase.rpc('similar_games', { p_game_id: id, p_limit: CANDIDATES })))
      .then((res) => { if (alive) setScored({ key: seedKey, rows: res.flatMap((r) => (r.error ? [] : (r.data as Row[]) || [])) }); })
      .catch(() => { if (alive) setScored({ key: seedKey, rows: [] }); });
    return () => { alive = false; };
  }, [seedKey]);

  const shown = useMemo(() => {
    if (!ready || !index || !scored || scored.key !== seedKey) return [];
    const byId = new Map((index as CardGame[]).map((g) => [g.id, g]));
    const skip = new Set([...ids, ...homeExcluded]);
    const total = new Map<string, number>();
    for (const r of scored.rows) if (!skip.has(r.game_id)) total.set(r.game_id, (total.get(r.game_id) || 0) + r.score);
    const user = pcReady && pc && myPcOn ? toUserPc(pc) : null;
    return [...total.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => byId.get(id))
      .filter((g): g is CardGame => !!g && (!user || runsOnMyPc(user, g)))
      .slice(0, PEOPLE_SHOW);
  }, [ready, index, scored, seedKey, ids, homeExcluded, pcReady, pc, myPcOn]);

  // 보여줄 카드 3장의 평가·태그·한국어 지원은 게임 목록에 없어 따로 읽는다 (못 읽으면 그 줄만 빠짐)
  const shownKey = shown.map((g) => g.id).join(',');
  const [extras, setExtras] = useState<{ key: string; map: Record<string, CardExtras> } | null>(null);
  useEffect(() => {
    if (!shownKey) return;
    let alive = true;
    getCardExtras(shownKey.split(',')).then((map) => { if (alive) setExtras({ key: shownKey, map }); }).catch(() => {});
    return () => { alive = false; };
  }, [shownKey]);
  const extraMap = extras && extras.key === shownKey ? extras.map : {};

  if (shown.length === 0) return null;
  return (
    <section className="home-block people-block" aria-labelledby="wishlist-recs-title">
      <div className="home-block-head">
        <h2 id="wishlist-recs-title" className="section-title">찜한 게임과 비슷한 게임</h2>
      </div>
      <div className="people-cards">
        {shown.map((g) => <div key={g.id} className="people-item"><ResultCard game={{ ...g, ...extraMap[g.id] }} tree={null} compact rich /></div>)}
      </div>
    </section>
  );
}
