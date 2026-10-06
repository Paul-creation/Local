'use client';

import QuickLinks from './QuickLinks';
import { usePeople } from './PeopleContext';

// 인원별 추천 바로 아래 빠른 칩 줄 — 서버에서 그린 홈 섹션 안에 놓여서 메인 필터는 PeopleContext로 받는다
export default function HomeQuickLinks() {
  const { filters } = usePeople();
  return filters ? <div className="people-chips"><QuickLinks filters={filters} /></div> : null;
}
