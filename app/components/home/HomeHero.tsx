// 담당: Paul(메인 배너·디자인)
'use client';

import SearchPanel from '../search/SearchPanel';
import QuickLinks from './QuickLinks';
import { getCurrentEvent, eventHref } from '../../lib/event';
import type { GameFilters } from '../../lib/useGameFilters';

// 이벤트 영역 + 가운데 큰 검색창. 검색 결과를 볼 때는 이벤트를 숨기고 검색창만 위에 남긴다.
export default function HomeHero({ games, filters, showEvent }: { games: any[], filters: GameFilters, showEvent: boolean }) {
  const event = getCurrentEvent();

  return (
    <div className={`home-hero${showEvent ? ' is-home' : ''}`}>
      {showEvent && (
        <section className="home-event">
          <div className="home-event-emoji" aria-hidden="true">{event.emoji}</div>
          <h1 className="home-event-title">{event.title}</h1>
          <p className="home-event-desc">{event.description}</p>
          {/* 새로 불러와야 필터 상태가 주소에서 다시 읽히므로 Link 대신 a */}
          <a href={eventHref(event)} className="home-event-cta">보러 가기 →</a>
        </section>
      )}

      {/* 검색창은 모드가 바뀌어도 같은 자리에 두어 입력 중 포커스가 유지되게 */}
      <div className="home-search">
        <SearchPanel games={games} filters={filters} />
      </div>
      {showEvent && <QuickLinks filters={filters} />}
    </div>
  );
}
