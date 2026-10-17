'use client';

import { useOwned } from '../owned/useOwned';

// 인원별 추천 아래 한 줄 링크 — 로그인했고 Steam 보유 목록이 공개일 때만 (서버는 빈 슬롯, 로그인 상태는 브라우저에서 확인해 페이지 캐시를 깨지 않는다)
export default function LibraryLink() {
  const { ready, visibility } = useOwned();
  if (!ready || visibility !== 'public') return null;
  return <a href="/library" className="people-more library-link">내 라이브러리에서 친구랑 할 게임 찾기 →</a>;
}
