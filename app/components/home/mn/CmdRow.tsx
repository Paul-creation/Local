'use client';

import { FREE_ONLY } from '../../../lib/rangeFilter';
import type { GameFilters } from '../../../lib/useGameFilters';
import MyPcLink from '../../pcspec/MyPcLink';
import { useMyPc } from '../../pcspec/useMyPc';
import { usePeople } from '../PeopleContext';

// 커맨드바 아랫줄 — 칩만 (인원 탭은 "N인 추천 게임" 머리로 옮겼다: PeopleTabs). 동작은 예전 PeopleSelect·QuickLinks와 같다
// - 내 PC로 돌아가는 게임: 사양을 저장해 뒀으면 인원별 추천을 거르는 토글, 없으면 /my-pc(사양 등록)로 가는 링크
// - 무료: 검색의 "무료만"(?price=0-0) / 데모: 검색의 "데모 있음"(?demo=1, 출시 예정이고 스팀 데모가 있는 게임) / 지금 할인 중: 검색의 "지금 할인 중"(?sale=1) — 결과 화면으로 이동
export default function CmdRow({ filters }: { filters: GameFilters }) {
  const { myPcOn, setMyPcOn } = usePeople();
  const { pc, ready } = useMyPc();
  const myPcActive = ready && !!pc && myPcOn;
  const show = (apply: () => void) => {
    apply();
    filters.setShowResults(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  return (
    <div className="mn-cmd-row">
      <div className="mn-chips">
        {/* 사양은 이 브라우저(localStorage)에만 있어서 서버는 토글인지 등록 링크인지 모른다 — 읽기 전에는 같은 글자의 보이지 않는 칩으로 자리를 잡아 칩 줄이 다시 정렬되지 않게 */}
        {!ready ? (
          <span className="mn-chip" style={{ visibility: 'hidden' }} aria-hidden="true">내 PC로 돌아가는 게임</span>
        ) : pc ? (
          <button type="button" className={`mn-chip${myPcOn ? ' on' : ''}`} aria-pressed={myPcOn} onClick={() => setMyPcOn(!myPcOn)}>내 PC로 돌아가는 게임</button>
        ) : (
          <MyPcLink className="mn-chip">내 PC로 돌아가는 게임</MyPcLink>
        )}
        <button type="button" className="mn-chip" onClick={() => show(() => filters.setPriceRange(FREE_ONLY))}>무료</button>
        <button type="button" className="mn-chip" onClick={() => show(() => filters.setDemoOnly(true))}>출시 전 데모</button>
        <button type="button" className="mn-chip" onClick={() => show(() => filters.setSaleOnly(true))}>지금 할인 중</button>
      </div>
    </div>
  );
}
