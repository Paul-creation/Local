// 담당: Paul(메인 배너·디자인)
// 서버 컴포넌트 — 메인 첫 HTML에 바로 들어감 (차트처럼 움직이는 부분만 클라이언트 컴포넌트)
import type { ReactNode } from 'react';
import HotChart from './HotChart';
import type { HotTab } from '../../lib/hotChart';
import type { PostListItem } from '../../lib/community';
import PopularPosts from './PopularPosts';
import FeatureCard from './FeatureCard';
import StreamerSection from './StreamerSection';
import PeopleRecs from './PeopleRecs';
import WishlistRecs from './WishlistRecs';
import HomeQuickLinks from './HomeQuickLinks';
import type { PeopleRecs as PeopleRecsData } from '../../lib/peopleRecs';
import type { StreamerTheme } from '../../lib/streamerTheme';
import { preconnect } from 'react-dom';

// 공개 글이 이만큼 이상일 때만 인기 게시물을 보인다 (getPopularPosts는 글이 5개 이상이면 항상 5개를 돌려준다). 그 미만이면 맨 아래 "커뮤니티 가기" 링크만
const POPULAR_MIN = 5;

// event: 이벤트 배너(HomeEvent) — 인원별 추천 바로 아래 / featured: featured_games에서 뽑힌 이번 주 게임, 기록이 없으면 예전처럼 featured 칸 (app/page.tsx에서 고름)
export default function HomeSections({ event, featured, hotTabs, popularPosts = [], streamerTheme = null, peopleRecs = null, homeExcluded = [] }: { event: ReactNode; featured: any; hotTabs: HotTab[]; popularPosts?: PostListItem[]; streamerTheme?: StreamerTheme | null; peopleRecs?: PeopleRecsData | null; homeExcluded?: string[] }) {

  // 스팀 이미지 서버에 미리 연결 — 첫 화면은 인원별 추천 카드라 이번주의 게임 이미지는 따로 미리 받지 않는다 (화면 아래, 스크롤하면 지연 로딩)
  preconnect('https://shared.akamai.steamstatic.com');

  const showPopular = popularPosts.length >= POPULAR_MIN;

  // 순서: 인원별 추천 → 이벤트 → 빠른 칩 줄 → 찜 기반 추천(찜이 있을 때) → 지금 뜨는 게임 → 이번주의 게임 → 스트리머 → 인기 게시물 또는 커뮤니티 링크 (인원 버튼은 검색창 바로 아래, HomeHero)
  return (
    <>
      <PeopleRecs recs={peopleRecs} />
      {event}
      <HomeQuickLinks />
      <WishlistRecs homeExcluded={homeExcluded} />

      {/* 지금 뜨는 게임 — 데이터는 page.tsx에서 따로 가져옴 (lib/hotChart) */}
      {hotTabs.length > 0 && <HotChart tabs={hotTabs} />}

      {featured && (
        <div className="feature-solo">
          <FeatureCard game={featured} label="이번주의 게임" sub={featured.weekLabel} />
        </div>
      )}

      {/* 스트리머들이 밤새운 협동 게임 — 위 섹션에 나온 게임은 뺀 뒤 선정, 6개 미만이면 통째로 숨김 (lib/streamerTheme) */}
      <StreamerSection theme={streamerTheme} />

      {showPopular && <PopularPosts posts={popularPosts} />}
    </>
  );
}
