// 담당: Paul(메인 배너·디자인)
'use client';

import type { ReactNode } from 'react';
import SearchPanel from '../search/SearchPanel';
import QuickLinks from './QuickLinks';
import type { GameFilters } from '../../lib/useGameFilters';

// 이벤트 영역 + 가운데 큰 검색창. 검색 결과를 볼 때는 이벤트를 숨기고 검색창만 위에 남긴다.
// event: 서버에서 그린 이벤트 영역 (HomeEvent). home-only로 감싼 부분은 필터 주소로 들어온 첫 HTML에서 숨김 (globals.css)
export default function HomeHero({ event, games, presentTags, filters, showEvent }: { event: ReactNode, games: any[], presentTags: string[], filters: GameFilters, showEvent: boolean }) {
  return (
    <div className={`home-hero${showEvent ? ' is-home' : ''}`}>
      {showEvent && <div className="home-only">{event}</div>}

      {/* 검색창은 모드가 바뀌어도 같은 자리에 두어 입력 중 포커스가 유지되게 */}
      <div className="home-search">
        <SearchPanel games={games} presentTags={presentTags} filters={filters} />
      </div>
      {showEvent && <div className="home-only"><QuickLinks filters={filters} /></div>}
    </div>
  );
}
