'use client';

import { useMemo } from 'react';
import GameCard from './GameCard';
import { useMyPc } from '../pcspec/useMyPc';
import { toUserPc } from '../../lib/myPc';
import { runsOnMyPc } from '../../lib/specJudge';
import { PEOPLE_SHOW, type PeopleRecs as Data } from '../../lib/peopleRecs';
import { usePeople } from './PeopleContext';
import { peopleLabel, peopleHref } from './PeopleSelect';

// 메인 인원별 추천 — 서버가 인원 4종 후보를 한 번에 보냈으므로 버튼을 눌러도 페이지 이동·추가 요청 없이 바로 바뀐다
// 내 PC 토글이 켜져 있으면(사양 저장 시) 최소 사양 미달 게임을 빼고, 3개가 안 되면 있는 만큼만 보여준다
// "전체 보기"는 메인 검색 주소(?players=)에 같은 조건(내 PC 포함)을 담아 연결
export default function PeopleRecs({ recs }: { recs: Data | null }) {
  const { n, myPcOn } = usePeople();
  const { pc, ready } = useMyPc();
  const myPcActive = ready && !!pc && myPcOn;
  const games = useMemo(() => {
    if (!recs) return [];
    const user = myPcActive && pc ? toUserPc(pc) : null;
    const list = recs.ids[n].map((id) => recs.games[id]);
    return (user ? list.filter((g) => runsOnMyPc(user, g)) : list).slice(0, PEOPLE_SHOW);
  }, [recs, n, myPcActive, pc]);
  if (!recs) return null;
  const href = peopleHref(n, myPcActive);
  return (
    <section className="home-block people-block" aria-labelledby="people-recs-title">
      <div className="home-block-head">
        <h2 id="people-recs-title" className="section-title">{peopleLabel(n)} 추천 게임</h2>
      </div>
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
