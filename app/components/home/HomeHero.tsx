// 담당: Paul(메인 배너·디자인)
'use client';

import SearchPanel from '../search/SearchPanel';
import PeopleSelect from './PeopleSelect';
import type { GameFilters } from '../../lib/useGameFilters';

// 히어로(제목·한 줄 설명) + 검색창·필터·AI 추천 + 인원 선택. 검색 결과를 볼 때는 검색창 줄만 위에 남긴다.
// home-only로 감싼 부분은 필터 주소로 들어온 첫 HTML에서 숨김 (globals.css). 이벤트 배너는 홈 섹션(HomeSections)으로 옮겼다
export default function HomeHero({ games, filters, showEvent, sidebar = false }: { games: any[], filters: GameFilters, showEvent: boolean, sidebar?: boolean }) {
  return (
    <div className={`home-hero${showEvent ? ' is-home' : ''}`}>
      {showEvent && (
        <div className="home-only">
          <div className="home-intro">
            <h1 className="home-intro-title">금요일 밤, 친구들이랑 뭐 하지?</h1>
            <p className="home-intro-desc">인원·가격·분위기로 골라 보세요.</p>
          </div>
        </div>
      )}

      {/* 검색창은 모드가 바뀌어도 같은 자리에 두어 입력 중 포커스가 유지되게 */}
      <div className="home-search">
        <SearchPanel games={games} filters={filters} sidebar={sidebar} />
      </div>
      {showEvent && <div className="home-only"><PeopleSelect /></div>}
    </div>
  );
}
