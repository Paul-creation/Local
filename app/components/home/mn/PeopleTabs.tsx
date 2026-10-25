'use client';

import { PEOPLE_CHOICES } from '../../../lib/peopleRecs';
import { PLAYERS_MAX } from '../../../lib/rangeFilter';
import { peopleButtonTarget } from '../../../lib/peopleLink';
import { useMyPc } from '../../pcspec/useMyPc';
import { usePeople } from '../PeopleContext';
import { peopleLabel } from '../PeopleSelect';

// "N인 추천 게임" 머리 아래 인원 탭(2인·3인·4인·5인 이상) — 선택한 인원은 제목의 N과 아래 목록을 바꾼다 (PeopleContext, 기본값·저장 방식은 그대로)
// 추천 데이터가 없으면(recsReady 거짓) 탭은 선택 표시만 바꾸고 바로 그 인원의 검색 결과(/?players=N)로 이동 (예전 히어로 탭과 같은 동작)
export default function PeopleTabs() {
  const { n, setN, myPcOn, recsReady } = usePeople();
  const { pc, ready } = useMyPc();
  const myPcActive = ready && !!pc && myPcOn;
  return (
    <div className="mn-tabs is-section" role="group" aria-label="몇 명이서 할까요?">
      {PEOPLE_CHOICES.map((v) => (
        <button key={v} type="button" className={`mn-tab${n === v ? ' on' : ''}`} aria-pressed={n === v} onClick={() => { setN(v); const to = peopleButtonTarget(recsReady, v, myPcActive, PLAYERS_MAX); if (to) window.location.assign(to); }}>{peopleLabel(v)}</button>
      ))}
    </div>
  );
}
