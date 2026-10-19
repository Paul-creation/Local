'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import GameCard from './GameCard';
import { useWishlist } from '../wishlist/useWishlist';
import { useMyPc } from '../pcspec/useMyPc';
import { useOwned, hasLoggedInCookie } from '../owned/useOwned';
import { useGameIndex } from '../../lib/useGameIndex';
import { useTaste } from '../../lib/useTaste';
import { supabase } from '../../lib/supabase';
import { toUserPc } from '../../lib/myPc';
import { runsOnMyPc } from '../../lib/specJudge';
import { MIN_OWNED_FOR_TASTE, rankByTaste } from '../../lib/taste';
import { getPriceInfo } from '../../lib/price';
import type { CardGame } from '../../lib/peopleRecs';
import { getCardExtras } from '../../lib/cardExtras';
import type { CardExtras } from '../../lib/cardInfo';
import { usePeople } from './PeopleContext';

// 메인 개인 추천 — 위에서부터 먼저 맞는 것 하나만 보인다
// 1) 로그인 + 보유 목록 있음(공개 또는 예전 목록) + 보유 5개 이상: "취향에 맞는 게임" — /library 취향 탭과 같은 계산(rankByTaste)과 같은 결과. 보유 게임만으로 취향을 만들고 보유 게임은 결과에서 뺀다(찜은 계산에도 제외에도 쓰지 않음)
// 2) 찜목록(localStorage)이 있음: "찜한 게임과 비슷한 게임" — 가장 최근에 찜한 3개마다 game_similar(상세 "비슷한 게임"과 같은 표)를 읽어 점수를 합치고 찜한 게임 자체는 뺀다
// 3) 둘 다 없으면 숨김. 취향 정보를 못 받았거나 겹치는 취향이 없으면 2)로 넘어간다
// /api/games/taste는 1) 조건을 채운 로그인 사용자만 부른다. 카드는 메인 검색용 전체 목록(useGameIndex)에서 가져온다
// 메인 노출 제외 게임(homeExcluded)은 뺀다. 내 PC 토글이 켜져 있으면 최소 사양 미달도 뺀다. 인원별 추천과 같은 가로 캐러셀(PC는 화살표, 모바일은 스와이프)
const SEEDS = 3;
const SHOW = 8;
type Row = { similar_id: string; score: number };

export default function PersonalRecs({ homeExcluded }: { homeExcluded: string[] }) {
  const { ids, ready } = useWishlist();
  const { myPcOn } = usePeople();
  const { pc, ready: pcReady } = useMyPc();
  const owned = useOwned();
  const { games: index } = useGameIndex();

  // 로그인 표시 쿠키는 브라우저에서만 읽는다 — 서버 첫 화면과 같게 hydration 뒤에 확인
  const loggedIn = useSyncExternalStore(() => () => {}, hasLoggedInCookie, () => false);

  const tasteWanted = owned.ready && (owned.visibility === 'public' || owned.visibility === 'private' || owned.visibility === 'unknown') && owned.count >= MIN_OWNED_FOR_TASTE;
  const { rows: tasteRows, error: tasteError } = useTaste(tasteWanted);
  const tasteRanked = useMemo(() => {
    if (!tasteWanted || !tasteRows || !index) return null;
    const list = index as CardGame[];
    const byId = new Map(list.map((g) => [g.id, g]));
    const profileIds = new Set<string>(list.filter((g) => owned.has((g as any).steam_appid)).map((g) => g.id)); // eslint-disable-line @typescript-eslint/no-explicit-any
    return rankByTaste(tasteRows, profileIds, (id) => { const g = byId.get(id) as any; return (g && getPriceInfo(g)?.discount) || 0; }, (id) => (byId.get(id) as any)?.heat_rank ?? Infinity) // eslint-disable-line @typescript-eslint/no-explicit-any
      .map((r) => byId.get(r.id))
      .filter((g): g is CardGame => !!g);
  }, [tasteWanted, tasteRows, index, owned]);

  const tasteFailed = tasteError || (!!tasteRanked && tasteRanked.length === 0);
  const tasteMode = tasteWanted && !tasteFailed;
  const wishMode = ready && ids.length > 0 && !tasteMode;

  const seedKey = useMemo(() => ids.slice(-SEEDS).join(','), [ids]);
  const [scored, setScored] = useState<{ key: string; rows: Row[] } | null>(null);
  useEffect(() => {
    if (!wishMode || !seedKey) return;
    let alive = true;
    supabase.from('game_similar').select('similar_id, score').in('game_id', seedKey.split(','))
      .then((res) => { if (alive) setScored({ key: seedKey, rows: res.error ? [] : ((res.data as Row[]) || []) }); })
      .then(undefined, () => { if (alive) setScored({ key: seedKey, rows: [] }); });
    return () => { alive = false; };
  }, [wishMode, seedKey]);

  const shown = useMemo(() => {
    let candidates: CardGame[] = [];
    if (tasteMode) {
      candidates = tasteRanked ?? [];
    } else if (wishMode && index && scored && scored.key === seedKey) {
      const byId = new Map((index as CardGame[]).map((g) => [g.id, g]));
      const skip = new Set(ids);
      const total = new Map<string, number>();
      for (const r of scored.rows) if (!skip.has(r.similar_id)) total.set(r.similar_id, (total.get(r.similar_id) || 0) + r.score);
      candidates = [...total.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => byId.get(id)).filter((g): g is CardGame => !!g);
    }
    const user = pcReady && pc && myPcOn ? toUserPc(pc) : null;
    const skipHome = new Set(homeExcluded);
    return candidates.filter((g) => !skipHome.has(g.id) && (!user || runsOnMyPc(user, g))).slice(0, SHOW);
  }, [tasteMode, tasteRanked, wishMode, index, scored, seedKey, ids, homeExcluded, pcReady, pc, myPcOn]);

  // 보여줄 카드의 평가·태그·한국어 지원은 게임 목록에 없어 따로 읽는다 (못 읽으면 그 줄만 빠짐)
  const shownKey = shown.map((g) => g.id).join(',');
  const [extras, setExtras] = useState<{ key: string; map: Record<string, CardExtras> } | null>(null);
  useEffect(() => {
    if (!shownKey) return;
    let alive = true;
    getCardExtras(shownKey.split(',')).then((map) => { if (alive) setExtras({ key: shownKey, map }); }).catch(() => {});
    return () => { alive = false; };
  }, [shownKey]);
  const extraMap = extras && extras.key === shownKey ? extras.map : {};

  // 가로 캐러셀 끝 표시 (PeopleRecs와 같은 방식)
  const rowRef = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ start: true, end: false });
  const updateEdge = useCallback(() => {
    const el = rowRef.current;
    if (!el) return;
    const start = el.scrollLeft <= 1;
    const end = el.scrollLeft + el.clientWidth >= el.scrollWidth - 1;
    setEdge((e) => (e.start === start && e.end === end ? e : { start, end }));
  }, []);
  useEffect(() => { rowRef.current?.scrollTo({ left: 0, behavior: 'instant' }); updateEdge(); }, [shownKey, updateEdge]);
  useEffect(() => {
    window.addEventListener('resize', updateEdge);
    return () => window.removeEventListener('resize', updateEdge);
  }, [updateEdge]);
  const page = (dir: 1 | -1) => {
    const el = rowRef.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.9 });
  };

  // 받는 중에는 정지된 빈 틀 (200ms 안에 끝나면 보이지 않음). 로그인하지 않았고 찜도 없으면 틀 없이 숨김
  const loading = (loggedIn && !owned.ready) || (tasteMode && (!tasteRanked || !index)) || (wishMode && (!index || !scored || scored.key !== seedKey));
  if (shown.length === 0) {
    if (!loading) return null;
    return (
      <div className="home-block personal-skel" aria-hidden="true">
        <div className="people-cards">{[0, 1, 2, 3].map((i) => <div key={i} className="people-item"><div className="personal-skel-card" /></div>)}</div>
      </div>
    );
  }
  const title = tasteMode ? '취향에 맞는 게임' : '찜한 게임과 비슷한 게임';
  return (
    <section className="home-block people-block" aria-labelledby="personal-recs-title">
      <div className="home-block-head">
        <h2 id="personal-recs-title" className="section-title">{title}</h2>
        <div className="people-head-right">
          {tasteMode && <a href="/library?tab=taste" className="home-more">더 보기 →</a>}
          {shown.length > 3 && (
            <div className="people-arrows">
              <button type="button" className="people-arrow" aria-label="이전 추천 게임" disabled={edge.start} onClick={() => page(-1)}>‹</button>
              <button type="button" className="people-arrow" aria-label="다음 추천 게임" disabled={edge.end} onClick={() => page(1)}>›</button>
            </div>
          )}
        </div>
      </div>
      <div className="people-cards" ref={rowRef} onScroll={updateEdge} tabIndex={0} role="region" aria-label={`${title} 목록`}>
        {shown.map((g) => <div key={g.id} className="people-item"><GameCard game={{ ...g, ...extraMap[g.id] }} /></div>)}
      </div>
    </section>
  );
}
