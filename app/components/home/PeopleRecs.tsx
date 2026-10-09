'use client';

import { useMemo } from 'react';
import GameCard from './GameCard';
import { useMyPc } from '../pcspec/useMyPc';
import { toUserPc } from '../../lib/myPc';
import { runsOnMyPc } from '../../lib/specJudge';
import type { PeopleRecs as Data } from '../../lib/peopleRecs';
import { choosePeopleGames } from '../../lib/peopleShow';
import { usePeople } from './PeopleContext';
import { peopleLabel, peopleHref } from './PeopleSelect';

// 메인 인원별 추천 — 서버가 인원 4종 후보를 한 번에 보냈으므로 버튼을 눌러도 페이지 이동·추가 요청 없이 바로 바뀐다
// 서버가 인원별 후보 12개를 날짜 시드 순서로 보냄 — 내 PC 토글(기본 꺼짐)이 꺼져 있거나 사양이 없으면 앞 3개, 켜져 있으면 최소 사양 통과 게임을 앞에서부터 3개
// (통과가 3개 미만이면 남는 자리는 통과 못 한 후보를 필터 전 순서로 채우고, 0개면 필터 전 앞 3개 + 안내 한 줄과 필터 끄기 버튼. 후보 자체가 없을 때만 "추천 게임이 아직 없어요")
// "전체 보기"는 메인 검색 주소(?players=)에 같은 조건(내 PC 포함)을 담아 연결
export default function PeopleRecs({ recs }: { recs: Data | null }) {
  const { n, myPcOn, setMyPcOn } = usePeople();
  const { pc, ready } = useMyPc();
  const myPcActive = ready && !!pc && myPcOn;
  const { games, filteredOut } = useMemo(() => {
    if (!recs) return { games: [], filteredOut: false };
    const user = myPcActive && pc ? toUserPc(pc) : null;
    return choosePeopleGames(recs.ids[n].map((id) => recs.games[id]), user ? (g) => runsOnMyPc(user, g) : null);
  }, [recs, n, myPcActive, pc]);
  if (!recs) return null;
  const href = peopleHref(n, myPcActive);
  return (
    <section className="home-block people-block" aria-labelledby="people-recs-title">
      <div className="home-block-head">
        <h2 id="people-recs-title" className="section-title">{peopleLabel(n)} 추천 게임</h2>
      </div>
      {filteredOut && (
        <div className="people-empty-box">
          <p className="people-empty">내 PC 사양을 통과한 추천이 없어 전체 추천을 보여줘요</p>
          <button type="button" className="btn btn-outline" onClick={() => setMyPcOn(false)}>내 PC 필터 끄기</button>
        </div>
      )}
      {games.length > 0 ? (
        <div className="people-cards">
          {games.map((g, i) => <div key={g.id} className="people-item"><GameCard game={g} eager={i === 0} /></div>)}
        </div>
      ) : (
        <p className="people-empty">조건에 맞는 추천 게임이 아직 없어요</p>
      )}
      <a href={href} className="people-more">{peopleLabel(n)} 게임 전체 보기 →</a>
    </section>
  );
}
