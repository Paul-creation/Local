// 담당: Paul(메인 배너·디자인)
// 서버 컴포넌트 — 메인 첫 HTML에 바로 들어감 (배너·차트처럼 움직이는 부분만 클라이언트 컴포넌트)
import BannerCarousel from '../BannerCarousel';
import HotChart from './HotChart';
import type { HotTab } from '../../lib/hotChart';
import type { PostListItem } from '../../lib/community';
import PopularPosts from './PopularPosts';
import FeatureCard from './FeatureCard';
import StreamerSection from './StreamerSection';
import PeopleRecs from './PeopleRecs';
import WishlistRecs from './WishlistRecs';
import type { PeopleRecs as PeopleRecsData } from '../../lib/peopleRecs';
import type { StreamerTheme } from '../../lib/streamerTheme';
import { preconnect, preload } from 'react-dom';
import { sizedImage } from '../../lib/imageUrl';

// featured: featured_games에서 뽑힌 이번 주 게임, 기록이 없으면 예전처럼 featured 칸 / bannerPool: 추천 배너 게임 (app/page.tsx에서 고름)
export default function HomeSections({ featured, bannerPool, hotTabs, popularPosts = [], streamerTheme = null, peopleRecs = null, homeExcluded = [] }: { featured: any; bannerPool: any[]; hotTabs: HotTab[]; popularPosts?: PostListItem[]; streamerTheme?: StreamerTheme | null; peopleRecs?: PeopleRecsData | null; homeExcluded?: string[] }) {

  // 카드 이미지는 스팀 헤더(460:215)를 카드 폭에 꽉 차게 — FeatureCard와 같은 주소·폭이어야 preload가 한 번만 받는다
  const featuredImage = featured ? featured.cover_image_url || featured.card_image_url : null;

  // 첫 화면 LCP(이번주의 게임 이미지)를 빨리 받도록 — 스팀 이미지 서버에 미리 연결하고, 그 이미지를 <head>에서 먼저 요청
  // preload 주소는 GameImage가 실제로 쓰는 주소(sizedImage, fallbackWidth 920)와 같아야 한 번만 받는다
  preconnect('https://shared.akamai.steamstatic.com');
  if (featuredImage) preload(sizedImage(featuredImage, 920), { as: 'image', fetchPriority: 'high' });

  // 순서: 인원별 추천 → 찜 기반 추천(찜이 있을 때) → 스트리머 → 지금 뜨는 게임 → 이번주의 게임·배너 → 인기 게시물 (인원 버튼은 검색창 바로 아래, HomeHero)
  return (
    <>
      <PeopleRecs recs={peopleRecs} />
      <WishlistRecs homeExcluded={homeExcluded} />

      {/* 스트리머들이 밤새운 협동 게임 — 선정이 6개 미만이면 통째로 숨김 (lib/streamerTheme). 인원 선택에 따라 스트리머 수로 거름 */}
      <StreamerSection theme={streamerTheme} />

      {/* 지금 뜨는 게임 — 데이터는 page.tsx에서 따로 가져옴 (lib/hotChart) */}
      {hotTabs.length > 0 && <HotChart tabs={hotTabs} />}

      {(featured || bannerPool.length > 0) && (
        <div className="feature-pair">
          {featured && <FeatureCard game={featured} label="이번주의 게임" sub={featured.weekLabel} priority />}
          {bannerPool.length > 0 && <BannerCarousel games={bannerPool} />}
        </div>
      )}

      {/* 인기 게시물 — 글이 하나도 없을 때만 숨김 (적으면 최근 글로 채움, lib/community) */}
      {popularPosts.length > 0 && <PopularPosts posts={popularPosts} />}
    </>
  );
}
