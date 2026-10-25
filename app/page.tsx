import GameGrid from './components/GameGrid';
import HomeEventLabel from './components/home/HomeEventLabel';
import HomeSections from './components/home/HomeSections';
import type { Metadata } from 'next';
import { BASE_OG, SITE_NAME, SITE_ALT_NAMES, SITE_URL, SITE_TITLE, SITE_META_DESCRIPTION } from './lib/site';
import { getHotChart } from './lib/hotChart';
import { getPopularPosts } from './lib/community';
import { HOME_FILTER_STYLE_ID } from './lib/homeFilter';
import { getStreamerNamesByGame } from './lib/streamerVideos';
import { getStreamerTheme } from './lib/streamerTheme';
import { getHomeCurators } from './lib/curators';
import { getPeopleRecs, getHomeExcludedIds } from './lib/peopleRecs';
import { getCovers, getHeroCovers, getHomeLists, getHomeStats } from './lib/homeMain';

// 5분마다 새로 만든 결과를 모두에게 보여준다 (방문마다 DB를 조회하지 않도록). 인기 글·가격도 최대 5분 늦게 반영
export const revalidate = 300;
export const metadata: Metadata = {
  alternates: { canonical: '/' },
  openGraph: { ...BASE_OG, title: SITE_TITLE, description: SITE_META_DESCRIPTION, url: '/' },
};

// 구조화 데이터(WebSite) — 검색 결과의 사이트 이름 표시용
const websiteJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: SITE_NAME,
  alternateName: SITE_ALT_NAMES,
  url: SITE_URL + '/',
  description: SITE_META_DESCRIPTION,
  inLanguage: 'ko',
};

// 필터가 담긴 주소(/?sale=1, /?r=1&p=… 등)로 들어오면, React가 그리기 전 첫 HTML에서 홈 섹션을 숨기고 로딩 막대를 보여준다
// (홈 화면이 잠깐 보였다가 결과로 바뀌는 깜빡임 방지). useGameFilters가 주소를 읽은 뒤 이 스타일을 지운다
const HOME_FILTER_SCRIPT = `(function(){try{if(/[?&](r|q|cat|tags|act|ex|barrier|story|net|p|d|free|sale|cmp|players|price|solo|demo)=/.test(location.search)){var s=document.createElement('style');s.id='${HOME_FILTER_STYLE_ID}';s.textContent='.home-only{display:none!important}.home-url-skel{display:block!important}';document.head.appendChild(s)}}catch(e){}})();`;

export default async function Home() {
  // 전체 게임 목록은 여기서 보내지 않는다 — 검색·필터용 목록은 첫 화면 뒤에 /api/games/list로 따로 받음 (lib/gameIndex)
  // 인기 차트(lib/hotChart, 기존 "지금 뜨는 게임" 순위)·인기 게시물(최근 7일 추천+댓글 순 5개)·히어로 숫자·배경 표지는 필요한 것만 따로
  const [hot, popularPosts, stats, heroCovers] = await Promise.all([
    getHotChart().catch(() => ({ tabs: [], top10Ids: [] as string[] })),
    getPopularPosts().catch(() => []),
    getHomeStats().catch(() => ({ games: null, sale: null, soon: null })),
    getHeroCovers().catch(() => [] as string[]),
  ]);

  // 인기 차트에 보이는 게임들의 스트리머를 한 번에 읽어 붙인다 (실패해도 배지만 빠짐)
  const names = await getStreamerNamesByGame([...new Set(hot.tabs.flatMap((t) => t.items.map((i) => i.id)))]).catch(() => new Map<string, string[]>());
  const hotTabs = hot.tabs.map((t) => ({ ...t, items: t.items.map((i) => ({ ...i, streamers: names.get(i.id) ?? [] })) }));

  // 인원별 추천 — 지금 뜨는 게임(모든 탭 10위까지)과 겹치는 건 뺀다. 실패하면 줄만 빠짐
  const hotShown = [...new Set(hot.tabs.flatMap((t) => t.items.map((i) => i.id)))];
  const [peopleRecs, homeExcluded, curators, lists] = await Promise.all([
    getPeopleRecs(hotShown).catch(() => null),
    getHomeExcludedIds().catch(() => [] as string[]),
    getHomeCurators().catch(() => null),
    getHomeLists((hotTabs.find((t) => t.key === 'friends') ?? hotTabs.find((t) => t.key === 'all'))?.items ?? []),
  ]);

  // 인원별 추천 카드에 세로 표지를 덧붙인다 (카드 조회에는 없는 칸 — 못 읽으면 가로 이미지로 대체)
  if (peopleRecs) {
    const covers = await getCovers(Object.keys(peopleRecs.games)).catch(() => ({}));
    for (const [id, c] of Object.entries(covers)) peopleRecs.games[id] = { ...peopleRecs.games[id], cover_vertical_url: c.vertical };
  }

  // 스트리머 협동은 위 섹션(인원별 추천 4종 전부·인기 차트 탭들의 1~10위)에 나온 게임을 먼저 빼고 고른다 (기준 미달이면 lib 안에서 중복 제거 없이 다시 고름)
  const shownAbove = [
    ...(peopleRecs ? Object.values(peopleRecs.ids).flat() : []),
    ...hotShown,
  ];
  const streamerTheme = await getStreamerTheme(shownAbove).catch(() => null);

  return (
    <main className="page">
      <script dangerouslySetInnerHTML={{ __html: HOME_FILTER_SCRIPT }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd).replace(/</g, '\\u003c') }} />
      <GameGrid
        peopleReady={!!peopleRecs}
        event={<HomeEventLabel />}
        sections={<HomeSections lists={lists} popularPosts={popularPosts} streamerTheme={streamerTheme} peopleRecs={peopleRecs} homeExcluded={homeExcluded} curators={curators} />}
        top10Ids={hot.top10Ids}
        heroCovers={heroCovers}
        stats={stats}
      />
    </main>
  );
}
