import GameGrid from '../GameGrid';
import HomeSections, { HomeFirstSection } from './HomeSections';
import { SITE_NAME, SITE_ALT_NAMES, SITE_URL, SITE_META_DESCRIPTION } from '../../lib/site';
import { getHotChart } from '../../lib/hotChart';
import { getPopularPosts } from '../../lib/community';
import { HOME_FILTER_STYLE_ID } from '../../lib/homeFilter';
import { getStreamerNamesByGame } from '../../lib/streamerVideos';
import { getStreamerTheme } from '../../lib/streamerTheme';
import { getHomeCurators } from '../../lib/curators';
import { getPeopleRecs, getHomeExcludedIds } from '../../lib/peopleRecs';
import { getCovers, getHeroFeatured, getHomeLists } from '../../lib/homeMain';
import heroLinesData from '../../../docs/design/hero-lines.json';

// 메인 화면 서버 부분 — app/page.tsx(방문자)와 app/home-member/page.tsx(로그인 사용자, proxy.ts가 / 요청을 이쪽으로 다시 써 준다)가 같이 쓴다
// 방문자: 와이드 히어로 이미지 1장 + 검색창 + "N인 추천" 하나만 (인기 순위·스트리머·큐레이터·인기 글·개인 추천은 로그인 후)
// member: 이미지 히어로 없이 멘트 + 검색창 + 섹션들(개인 추천 → N인 추천 → 순위 → 스트리머 → 큐레이터 → 인기 글). 멘트는 docs/design/hero-lines.json 그대로. 두 페이지 모두 ISR이라 쿠키를 여기서 읽지 않는다
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

export default async function HomePage({ member = false }: { member?: boolean }) {
  // 전체 게임 목록은 여기서 보내지 않는다 — 검색·필터용 목록은 첫 화면 뒤에 /api/games/list로 따로 받음 (lib/gameIndex)
  // 인기 차트(lib/hotChart, 기존 "지금 뜨는 게임" 순위)는 로그인 후 순위 섹션과, 방문자 히어로의 대표 게임 후보(인기 순위)에 쓴다
  const [hot, popularPosts] = await Promise.all([
    getHotChart().catch(() => ({ tabs: [], top10Ids: [] as string[] })),
    member ? getPopularPosts().catch(() => []) : [],
  ]);
  const hotAllIds = (hot.tabs.find((t) => t.key === 'all') ?? hot.tabs[0])?.items.map((i) => i.id) ?? [];

  // 인기 차트에 보이는 게임들의 스트리머를 한 번에 읽어 붙인다 (실패해도 배지만 빠짐) — 로그인 후 순위 섹션만
  const names = member ? await getStreamerNamesByGame([...new Set(hot.tabs.flatMap((t) => t.items.map((i) => i.id)))]).catch(() => new Map<string, string[]>()) : new Map<string, string[]>();
  const hotTabs = hot.tabs.map((t) => ({ ...t, items: t.items.map((i) => ({ ...i, streamers: names.get(i.id) ?? [] })) }));

  // 인원별 추천 — 순위 섹션이 보일 때(로그인)만 거기 나오는 게임(모든 탭 10위까지)과 겹치는 건 뺀다. 실패하면 줄만 빠짐
  const hotShown = member ? [...new Set(hot.tabs.flatMap((t) => t.items.map((i) => i.id)))] : [];
  const [peopleRecs, hero, homeExcluded, curators, lists, streamerTheme] = await Promise.all([
    getPeopleRecs(hotShown).catch(() => null),
    member ? null : getHeroFeatured(hotAllIds).catch(() => null),
    member ? getHomeExcludedIds().catch(() => [] as string[]) : ([] as string[]),
    member ? getHomeCurators().catch(() => null) : null,
    member ? getHomeLists((hotTabs.find((t) => t.key === 'friends') ?? hotTabs.find((t) => t.key === 'all'))?.items ?? []) : null,
    // 스트리머 협동은 조건에 맞는 게임 전부 (가로 스크롤 줄)
    member ? getStreamerTheme().catch(() => null) : null,
  ]);

  // 인원별 추천 카드에 세로 표지를 덧붙인다 (카드 조회에는 없는 칸 — 못 읽으면 가로 이미지로 대체)
  if (peopleRecs) {
    const covers = await getCovers(Object.keys(peopleRecs.games)).catch(() => ({}));
    for (const [id, c] of Object.entries(covers)) peopleRecs.games[id] = { ...peopleRecs.games[id], cover_vertical_url: c.vertical };
  }

  return (
    <main className="page">
      <script dangerouslySetInnerHTML={{ __html: HOME_FILTER_SCRIPT }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd).replace(/</g, '\\u003c') }} />
      <GameGrid
        member={member}
        peopleReady={!!peopleRecs}
        firstSection={<HomeFirstSection peopleRecs={peopleRecs} member={member} homeExcluded={homeExcluded} />}
        sections={member && lists ? <HomeSections lists={lists} popularPosts={popularPosts} streamerTheme={streamerTheme} curators={curators} /> : undefined}
        top10Ids={hot.top10Ids}
        hero={hero}
        heroLines={member ? heroLinesData.lines : []}
      />
    </main>
  );
}
