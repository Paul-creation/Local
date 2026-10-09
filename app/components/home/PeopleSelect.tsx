'use client';

import { useState } from 'react';
import { PEOPLE_CHOICES, type PeopleN } from '../../lib/peopleRecs';
import { PLAYERS_MAX } from '../../lib/rangeFilter';
import { peopleHref as href, peopleButtonTarget } from '../../lib/peopleLink';
import PcSpecPanel from '../pcspec/PcSpecPanel';
import { useMyPc } from '../pcspec/useMyPc';
import { usePeople } from './PeopleContext';

export const peopleLabel = (n: number) => (n >= 5 ? '5인 이상' : `${n}인`);

// 메인 검색 주소(?players=)에 인원과 내 PC 조건을 담은 "전체 보기" 주소 — 인원별 추천의 전체 보기 링크와, 추천 데이터가 없을 때의 인원 버튼 이동이 같이 쓴다
export const peopleHref = (n: PeopleN, myPc: boolean) => href(n, myPc, PLAYERS_MAX);

// 검색창 바로 아래 "2인 / 3인 / 4인 / 5인 이상" 한 줄 4칸 + 내 PC 토글
// 인원별 추천 데이터가 없으면(recsReady 거짓) 버튼은 선택 표시만 바꾸고 바로 그 인원의 검색 결과(/?players=N)로 이동
// 내 PC 사양이 저장돼 있으면 "내 PC로 돌아가는 게임만"(기본 꺼짐 — 사양을 저장해도 자동으로 켜지 않음), 없으면 사양 입력 패널을 여는 텍스트 버튼
export default function PeopleSelect() {
  const { n, setN, myPcOn, setMyPcOn, recsReady } = usePeople();
  const { pc, ready } = useMyPc();
  const myPcActive = ready && !!pc && myPcOn;
  const [panel, setPanel] = useState(false);
  return (
    <div className="people-select">
      <div className="people-btns" role="group" aria-label="몇 명이서 할까요?">
        {PEOPLE_CHOICES.map((v) => (
          <button key={v} type="button" className={`people-btn${n === v ? ' on' : ''}`} aria-pressed={n === v} onClick={() => { setN(v); const to = peopleButtonTarget(recsReady, v, myPcActive, PLAYERS_MAX); if (to) window.location.assign(to); }}>{peopleLabel(v)}</button>
        ))}
      </div>
      {ready && (
        <div className="people-pc">
          {pc ? (
            <button type="button" className={`chip${myPcOn ? ' on' : ''}`} aria-pressed={myPcOn} onClick={() => setMyPcOn(!myPcOn)}>내 PC로 돌아가는 게임만</button>
          ) : (
            <button type="button" className="people-link" aria-expanded={panel} onClick={() => setPanel((v) => !v)}>내 PC로 돌아가는 게임 찾기</button>
          )}
        </div>
      )}
      {ready && !pc && panel && (
        <div className="people-panel"><PcSpecPanel onDone={() => setPanel(false)} onCancel={() => setPanel(false)} /></div>
      )}
    </div>
  );
}
