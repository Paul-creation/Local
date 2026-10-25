'use client';

import { PEOPLE_CHOICES } from '../../../lib/peopleRecs';
import { PLAYERS_MAX, FREE_ONLY } from '../../../lib/rangeFilter';
import { peopleButtonTarget } from '../../../lib/peopleLink';
import type { GameFilters } from '../../../lib/useGameFilters';
import MyPcLink from '../../pcspec/MyPcLink';
import { useMyPc } from '../../pcspec/useMyPc';
import { usePeople } from '../PeopleContext';
import { peopleLabel } from '../PeopleSelect';

// 커맨드바 아랫줄 — 인원 탭 | 칩. 동작은 예전 PeopleSelect·QuickLinks와 같다
// - 인원 탭: 선택한 인원은 아래 "N인 추천 게임"을 바꾼다 (추천 데이터가 없으면 /?players=N 검색으로 이동)
// - 내 PC로 돌아가는 게임: 사양을 저장해 뒀으면 인원별 추천을 거르는 토글, 없으면 /my-pc(사양 등록)로 가는 링크
// - 무료·데모: 검색의 "무료만"(?price=0-0) / 지금 할인 중: 검색의 "지금 할인 중"(?sale=1) — 결과 화면으로 이동
export default function CmdRow({ filters }: { filters: GameFilters }) {
  const { n, setN, myPcOn, setMyPcOn, recsReady } = usePeople();
  const { pc, ready } = useMyPc();
  const myPcActive = ready && !!pc && myPcOn;
  const show = (apply: () => void) => {
    apply();
    filters.setShowResults(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  return (
    <div className="mn-cmd-row">
      <div className="mn-tabs" role="group" aria-label="몇 명이서 할까요?">
        {PEOPLE_CHOICES.map((v) => (
          <button key={v} type="button" className={`mn-tab${n === v ? ' on' : ''}`} aria-pressed={n === v} onClick={() => { setN(v); const to = peopleButtonTarget(recsReady, v, myPcActive, PLAYERS_MAX); if (to) window.location.assign(to); }}>{peopleLabel(v)}</button>
        ))}
      </div>
      <span className="mn-cmd-sep" aria-hidden="true" />
      <div className="mn-chips">
        {ready && (pc ? (
          <button type="button" className={`mn-chip${myPcOn ? ' on' : ''}`} aria-pressed={myPcOn} onClick={() => setMyPcOn(!myPcOn)}>내 PC로 돌아가는 게임</button>
        ) : (
          <MyPcLink className="mn-chip">내 PC로 돌아가는 게임</MyPcLink>
        ))}
        <button type="button" className="mn-chip" onClick={() => show(() => filters.setPriceRange(FREE_ONLY))}>무료·데모</button>
        <button type="button" className="mn-chip" onClick={() => show(() => filters.setSaleOnly(true))}>지금 할인 중</button>
      </div>
    </div>
  );
}
