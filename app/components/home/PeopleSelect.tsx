'use client';

import { useState } from 'react';
import { PEOPLE_CHOICES } from '../../lib/peopleRecs';
import PcSpecPanel from '../pcspec/PcSpecPanel';
import { useMyPc } from '../pcspec/useMyPc';
import { usePeople } from './PeopleContext';

export const peopleLabel = (n: number) => (n >= 5 ? '5인 이상' : `${n}인`);

// 검색창 바로 아래 "2인 / 3인 / 4인 / 5인 이상" 한 줄 4칸 + 내 PC 토글
// 내 PC 사양이 저장돼 있으면 "내 PC로 돌아가는 게임만"(기본 켜짐), 없으면 사양 입력 패널을 여는 텍스트 버튼
export default function PeopleSelect() {
  const { n, setN, myPcOn, setMyPcOn } = usePeople();
  const { pc, ready } = useMyPc();
  const [panel, setPanel] = useState(false);
  return (
    <div className="people-select">
      <div className="people-btns" role="group" aria-label="몇 명이서 할까요?">
        {PEOPLE_CHOICES.map((v) => (
          <button key={v} type="button" className={`people-btn${n === v ? ' on' : ''}`} aria-pressed={n === v} onClick={() => setN(v)}>{peopleLabel(v)}</button>
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
        <div className="people-panel"><PcSpecPanel onDone={() => { setMyPcOn(true); setPanel(false); }} onCancel={() => setPanel(false)} /></div>
      )}
    </div>
  );
}
