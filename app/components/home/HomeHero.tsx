// 담당: Paul(메인 배너·디자인)
'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import SearchPanel from '../search/SearchPanel';
import PeopleSelect from './PeopleSelect';
import type { GameFilters } from '../../lib/useGameFilters';
import { GUIDE_STRIP } from '../../lib/guideCopy';

// 히어로: 이벤트 작은 라벨 → 헤드라인(주인공) → "1분 사용 가이드 →" 글자 링크 → 검색창(필터는 안쪽)+AI 추천 → 인원 pill·내 PC 칩. 검색 결과를 볼 때는 검색창 줄만 위에 남긴다.
// home-only로 감싼 부분은 필터 주소로 들어온 첫 HTML에서 숨김 (globals.css). event: 서버에서 그린 이벤트 라벨(HomeEventLabel)
export default function HomeHero({ games, filters, showEvent, sidebar = false, event }: { games: any[], filters: GameFilters, showEvent: boolean, sidebar?: boolean, event?: ReactNode }) {
  return (
    <div className={`home-hero${showEvent ? ' is-home' : ''}`}>
      {showEvent && (
        <div className="home-only">
          <div className="home-intro">
            {event}
            <h1 className="home-intro-title">금요일 밤, 친구들이랑 뭐 하지?</h1>
            <Link href={GUIDE_STRIP.href} className="hero-guide">{GUIDE_STRIP.text}</Link>
          </div>
        </div>
      )}

      {/* 검색창은 모드가 바뀌어도 같은 자리(둘째 칸, 인원 선택이 숨어도 칸은 그대로)에 두어 입력 중 포커스가 유지되게 */}
      <div className="home-search">
        <SearchPanel games={games} filters={filters} sidebar={sidebar} />
      </div>

      {/* 검색창 아래 인원 버튼 + 내 PC 바 */}
      {showEvent && <div className="home-only"><PeopleSelect /></div>}
    </div>
  );
}
