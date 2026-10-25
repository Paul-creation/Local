// 담당: Paul(메인 배너·디자인)
// 서버 컴포넌트 — 메인 첫 HTML에 바로 들어감 (인원별 추천·개인 추천처럼 상태가 있는 부분만 클라이언트 컴포넌트)
// 순서: 인원별 추천 → 3단 리스트(인기 차트·출시 예정·다시 뜨는 중) → 스트리머 협동 → 인스타 큐레이터 → 개인 추천(취향 또는 찜이 있을 때) → 인기 게시물
// 인원 탭·검색창·숫자는 히어로(mn/MainHero)에 있다
import PopularPosts from './PopularPosts';
import PeopleSection from './mn/PeopleSection';
import RankLists from './mn/RankLists';
import Streamers from './mn/Streamers';
import Curators from './mn/Curators';
import PersonalRecs from './PersonalRecs';
import type { PostListItem } from '../../lib/community';
import type { PeopleRecs as PeopleRecsData } from '../../lib/peopleRecs';
import type { StreamerTheme } from '../../lib/streamerTheme';
import type { HomeCurators } from '../../lib/curators';
import type { HomeLists } from '../../lib/homeMain';
import { preconnect } from 'react-dom';

// 공개 글이 이만큼 이상일 때만 인기 게시물을 보인다 (getPopularPosts는 글이 5개 이상이면 항상 5개를 돌려준다)
const POPULAR_MIN = 5;

export default function HomeSections({ lists, popularPosts = [], streamerTheme = null, peopleRecs = null, homeExcluded = [], curators = null }: { lists: HomeLists; popularPosts?: PostListItem[]; streamerTheme?: StreamerTheme | null; peopleRecs?: PeopleRecsData | null; homeExcluded?: string[]; curators?: HomeCurators | null }) {
  // 스팀 이미지 서버에 미리 연결 — 첫 화면은 인원별 추천 카드
  preconnect('https://shared.akamai.steamstatic.com');

  return (
    <>
      <PeopleSection recs={peopleRecs} />
      <RankLists lists={lists} />
      <Streamers theme={streamerTheme} />
      <Curators data={curators} />
      <PersonalRecs homeExcluded={homeExcluded} />
      {popularPosts.length >= POPULAR_MIN && <PopularPosts posts={popularPosts} />}
    </>
  );
}
