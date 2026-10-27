'use client';

import { useEffect, useMemo, useRef } from 'react';
import PosterCard, { posterBadge } from './PosterCard';
import { useMyPc } from '../../pcspec/useMyPc';
import { toUserPc } from '../../../lib/myPc';
import { runsOnMyPc } from '../../../lib/specJudge';
import type { PeopleRecs as Data } from '../../../lib/peopleRecs';
import { choosePeopleGames } from '../../../lib/peopleShow';
import { usePeople } from '../PeopleContext';
import { peopleLabel, peopleHref, trendingHref } from '../PeopleSelect';
import LibraryLink from '../LibraryLink';
import PeopleTabs from './PeopleTabs';

// 메인 "N인 추천 게임" — 서버가 인원 4종 후보를 한 번에 보냈으므로 히어로의 인원 탭을 눌러도 이동·추가 요청 없이 바로 바뀐다
// 후보(재부상 + 신작, 날짜 시드 순서)의 앞 6개를 세로 표지 카드 한 줄(가로 스크롤)로. 내 PC 토글이 켜져 있으면 최소 사양 통과 게임만 (규칙은 lib/peopleShow)
const SHOW = 6;

export default function PeopleSection({ recs }: { recs: Data | null }) {
  const { n, myPcOn, setMyPcOn } = usePeople();
  const { pc, ready } = useMyPc();
  const myPcActive = ready && !!pc && myPcOn;
  const { games, filteredOut } = useMemo(() => {
    if (!recs) return { games: [], filteredOut: false };
    const user = myPcActive && pc ? toUserPc(pc) : null;
    return choosePeopleGames(recs.ids[n].map((id) => recs.games[id]), user ? (g) => runsOnMyPc(user, g) : null, SHOW);
  }, [recs, n, myPcActive, pc]);
  // 카드가 바뀌면(인원·내 PC 전환) 가로 줄을 맨 앞으로 — 안 그러면 이전 스크롤 위치에서 첫 카드가 잘린다
  const rowRef = useRef<HTMLDivElement>(null);
  const gamesKey = games.map((g) => g.id).join(',');
  useEffect(() => { rowRef.current?.scrollTo({ left: 0, behavior: 'instant' }); }, [gamesKey]);
  // 추천 데이터가 없어도 머리(제목 + 인원 탭)는 그린다 — 탭이 그 인원의 검색 결과로 가는 길이라서
  return (
    <section className="mn-sec" aria-labelledby="mn-people-title">
      <div className="mn-sec-head mn-people-head">
        <div className="mn-people-head-left">
          <h2 id="mn-people-title">{peopleLabel(n)} 추천 게임</h2>
          <PeopleTabs />
        </div>
        <a href={trendingHref(n, myPcActive)} className="mn-more">뜨는 게임 더 보기</a>
      </div>
      {filteredOut && (
        <p className="mn-note">
          내 PC 사양을 통과한 추천이 없어 전체 추천을 보여줘요
          <button type="button" className="mn-chip" onClick={() => setMyPcOn(false)}>내 PC 필터 끄기</button>
        </p>
      )}
      {!recs ? null : games.length > 0 ? (
        <div className="mn-row" ref={rowRef} tabIndex={0} role="region" aria-label={`${peopleLabel(n)} 추천 게임 목록`}>
          {games.map((g, i) => <PosterCard key={g.id} game={g} eager={i < 3} tourId={i === 0 ? 'first-card' : undefined} badge={posterBadge(g, recs.badges[g.id])} />)}
        </div>
      ) : (
        <p className="mn-note">조건에 맞는 추천 게임이 아직 없어요</p>
      )}
      {recs && <div className="mn-links">
        <a href={peopleHref(n, myPcActive)} className="mn-more">{peopleLabel(n)} 게임 전체 보기</a>
        <LibraryLink />
      </div>}
    </section>
  );
}
