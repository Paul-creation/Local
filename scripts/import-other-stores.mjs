// scripts/import-other-stores.mjs
// 에픽(무료/할인 프로모션 피드 + 독점작) · 블리자드 · 라이엇 게임 가져오기
// 실행: node --env-file=.env.local scripts/import-other-stores.mjs
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 이름 비교용: 소문자 + 영숫자/한글만 남김 ("Diablo® IV" == "diablo iv")
const norm = (s = '') => s.toLowerCase().replace(/[^a-z0-9가-힣]/g, '');

// ─────────────────────────────────────────────
// 1) 수동 목록 — 블리자드 · 라이엇 · 에픽 독점작
//    스토어 공개 API가 없거나(블리자드/라이엇) 카탈로그 API가 불안정해서(에픽) 직접 관리
// ─────────────────────────────────────────────
const MANUAL_GAMES = [
  // Riot
  { source: 'riot', id: 'league-of-legends', name: 'League of Legends', is_free: true,
    description: '5대5 팀 전략 MOBA. 친구들과 랭크·칼바람으로 즐기기 좋은 대표 PC 게임.',
    store_url: 'https://www.leagueoflegends.com/ko-kr/' },
  { source: 'riot', id: 'valorant', name: 'VALORANT', is_free: true,
    description: '요원 스킬과 정밀한 사격이 결합된 5대5 전술 FPS.',
    store_url: 'https://playvalorant.com/ko-kr/' },
  { source: 'riot', id: 'teamfight-tactics', name: 'Teamfight Tactics', is_free: true,
    description: '롤 챔피언으로 즐기는 8인 오토배틀러. 롤 클라이언트에서 바로 플레이.',
    store_url: 'https://teamfighttactics.leagueoflegends.com/ko-kr/' },
  { source: 'riot', id: 'legends-of-runeterra', name: 'Legends of Runeterra', is_free: true,
    description: '룬테라 세계관의 전략 카드 게임.',
    store_url: 'https://playruneterra.com/ko-kr/' },
  { source: 'riot', id: '2xko', name: '2XKO', is_free: true,
    description: '롤 챔피언들이 등장하는 2대2 태그 대전 격투 게임.',
    store_url: 'https://2xko.riotgames.com/' },

  // Blizzard (Battle.net)
  { source: 'battlenet', id: 'overwatch-2', name: 'Overwatch 2', is_free: true,
    description: '개성 있는 영웅들로 싸우는 5대5 팀 기반 히어로 슈터.',
    store_url: 'https://overwatch.blizzard.com/ko-kr/' },
  { source: 'battlenet', id: 'diablo-iv', name: 'Diablo IV', is_free: false,
    description: '성역을 무대로 한 다크 판타지 액션 RPG. 최대 4인 협동.',
    store_url: 'https://diablo4.blizzard.com/ko-kr/' },
  { source: 'battlenet', id: 'diablo-ii-resurrected', name: 'Diablo II: Resurrected', is_free: false,
    description: '디아블로 2와 파괴의 군주를 리마스터한 액션 RPG.',
    store_url: 'https://diablo2.blizzard.com/ko-kr/' },
  { source: 'battlenet', id: 'diablo-iii', name: 'Diablo III', is_free: false,
    description: '최대 4인 협동으로 즐기는 핵앤슬래시 액션 RPG.',
    store_url: 'https://diablo3.blizzard.com/ko-kr/' },
  { source: 'battlenet', id: 'hearthstone', name: 'Hearthstone', is_free: true,
    description: '워크래프트 세계관의 전략 카드 게임. 전장 모드도 인기.',
    store_url: 'https://hearthstone.blizzard.com/ko-kr/' },
  { source: 'battlenet', id: 'heroes-of-the-storm', name: 'Heroes of the Storm', is_free: true,
    description: '블리자드 영웅들이 총출동하는 팀 전투 중심 MOBA.',
    store_url: 'https://heroesofthestorm.blizzard.com/ko-kr/' },
  { source: 'battlenet', id: 'starcraft-ii', name: 'StarCraft II', is_free: true,
    description: '테란·저그·프로토스의 실시간 전략 게임. 협동전 임무로 친구와 플레이 가능.',
    store_url: 'https://starcraft2.blizzard.com/ko-kr/' },
  { source: 'battlenet', id: 'starcraft-remastered', name: 'StarCraft: Remastered', is_free: false,
    description: '원작 스타크래프트와 브루드 워를 고화질로 리마스터.',
    store_url: 'https://starcraft.com/ko-kr/' },
  { source: 'battlenet', id: 'world-of-warcraft', name: 'World of Warcraft', is_free: false,
    description: '아제로스를 무대로 한 대표 MMORPG. 월 구독제.',
    store_url: 'https://worldofwarcraft.blizzard.com/ko-kr/' },
  { source: 'battlenet', id: 'warcraft-iii-reforged', name: 'Warcraft III: Reforged', is_free: false,
    description: '워크래프트 3와 프로즌 쓰론을 리메이크한 실시간 전략 게임.',
    store_url: 'https://playwarcraft3.com/ko-kr/' },

  // Epic 독점 / 에픽 전용
  { source: 'epic', id: 'fortnite', name: 'Fortnite', is_free: true,
    description: '건설과 배틀로얄이 결합된 슈터. 스쿼드로 친구들과 즐기기 좋음.',
    store_url: 'https://store.epicgames.com/ko/p/fortnite' },
  { source: 'epic', id: 'rocket-league', name: 'Rocket League', is_free: true,
    description: '로켓 자동차로 하는 축구. 2대2·3대3 파티 플레이에 최적.',
    store_url: 'https://store.epicgames.com/ko/p/rocket-league' },
  { source: 'epic', id: 'fall-guys', name: 'Fall Guys', is_free: true,
    description: '최대 60명이 장애물 코스를 달리는 파티 배틀로얄.',
    store_url: 'https://store.epicgames.com/ko/p/fall-guys' },
  { source: 'epic', id: 'alan-wake-2', name: 'Alan Wake 2', is_free: false,
    description: 'Remedy의 서바이벌 호러. 두 주인공의 시점을 오가는 스토리 중심 게임.',
    store_url: 'https://store.epicgames.com/ko/p/alan-wake-2' },
];

// ─────────────────────────────────────────────
// 2) 에픽 프로모션 피드 (무료 배포 + 예정작, KRW 가격 포함)
// ─────────────────────────────────────────────
async function fetchEpicPromotions() {
  const url =
    'https://store-site-backend-static-ipv4.ak.epicgames.com/freeGamesPromotions?locale=ko&country=KR&allowCountries=KR';
  try {
    const res = await fetch(url);
    const json = await res.json();
    const elements = json?.data?.Catalog?.searchStore?.elements || [];

    return elements
      .filter((e) => e.offerType === 'BASE_GAME' && !/mystery/i.test(e.title))
      .map((e) => {
        const slug =
          e.catalogNs?.mappings?.find((m) => m.pageType === 'productHome')?.pageSlug ||
          e.offerMappings?.find((m) => m.pageType === 'productHome')?.pageSlug ||
          e.productSlug?.replace(/\/home$/, '');
        if (!slug) return null;

        const wide =
          e.keyImages?.find((k) => k.type === 'OfferImageWide') ||
          e.keyImages?.find((k) => k.type === 'DieselStoreFrontWide') ||
          e.keyImages?.[0];

        const tp = e.price?.totalPrice;
        const decimals = tp?.currencyInfo?.decimals ?? 0;
        const div = 10 ** decimals;

        return {
          source: 'epic',
          id: slug,
          name: e.title,
          description: e.description,
          cover_image_url: wide?.url || null,
          store_url: `https://store.epicgames.com/ko/p/${slug}`,
          is_free: false,
          price:
            tp?.currencyCode === 'KRW'
              ? {
                  final: tp.discountPrice / div,
                  original: tp.originalPrice / div,
                }
              : null,
        };
      })
      .filter(Boolean);
  } catch (err) {
    console.error('에픽 프로모션 피드 실패:', err.message);
    return [];
  }
}

// ─────────────────────────────────────────────
// 3) IGDB — 수동 목록의 와이드 이미지 채우기
// ─────────────────────────────────────────────
async function getIgdbToken() {
  const res = await fetch(
    `https://id.twitch.tv/oauth2/token?client_id=${process.env.IGDB_CLIENT_ID}&client_secret=${process.env.IGDB_CLIENT_SECRET}&grant_type=client_credentials`,
    { method: 'POST' }
  );
  return (await res.json()).access_token;
}

async function fetchIgdbWideImage(name, token) {
  if (!token) return null;
  try {
    const res = await fetch('https://api.igdb.com/v4/games', {
      method: 'POST',
      headers: {
        'Client-ID': process.env.IGDB_CLIENT_ID,
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
      body: `fields name, artworks.image_id, screenshots.image_id; search "${name.replace(/"/g, '')}"; limit 1;`,
    });
    const g = (await res.json())?.[0];
    const imageId = g?.artworks?.[0]?.image_id || g?.screenshots?.[0]?.image_id;
    return imageId
      ? `https://images.igdb.com/igdb/image/upload/t_screenshot_big/${imageId}.jpg`
      : null;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────
// 4) 저장 — 이미 있는 게임(이름 일치)은 platform만 합치고, 없으면 새로 추가
// ─────────────────────────────────────────────
async function main() {
  const { data: existing, error } = await supabase
    .from('games')
    .select('id, name, platform, source, external_id, store_url');
  if (error) {
    console.error('기존 게임 조회 실패:', error.message);
    return;
  }

  const byName = new Map(existing.map((g) => [norm(g.name), g]));
  const byExternal = new Set(
    existing.filter((g) => g.external_id).map((g) => `${g.source}:${g.external_id}`)
  );

  const token = await getIgdbToken().catch(() => null);
  const epicPromos = await fetchEpicPromotions();
  console.log(`에픽 프로모션 ${epicPromos.length}개, 수동 목록 ${MANUAL_GAMES.length}개`);

  let added = 0;
  let merged = 0;

  for (const item of [...MANUAL_GAMES, ...epicPromos]) {
    const key = `${item.source}:${item.id}`;
    if (byExternal.has(key)) continue;

    // 스팀 등에 이미 있는 게임 → 플랫폼만 추가
    const match = byName.get(norm(item.name));
    if (match) {
      const platform = Array.from(new Set([...(match.platform || []), item.source]));
      if (platform.length !== (match.platform || []).length) {
        await supabase.from('games').update({ platform }).eq('id', match.id);
        match.platform = platform;
        console.log(`🔗 플랫폼 추가: ${match.name} +${item.source}`);
        merged++;
      }
      continue;
    }

    const cover = item.cover_image_url || (await fetchIgdbWideImage(item.name, token));
    if (!cover) {
      console.log(`⏭️  이미지 없음, 건너뜀: ${item.name}`);
      continue;
    }

    const { data: inserted, error: insErr } = await supabase
      .from('games')
      .insert({
        name: item.name,
        steam_appid: null,
        source: item.source,
        external_id: item.id,
        store_url: item.store_url,
        platform: [item.source],
        cover_image_url: cover,
        description: item.description,
        is_free: item.is_free,
        is_casual_party: false,
      })
      .select()
      .single();

    if (insErr) {
      console.error(`저장 실패 (${item.name}):`, insErr.message);
      continue;
    }

    if (item.price && item.price.original >= 100 && item.price.final >= 100) {
      const discount = Math.round((1 - item.price.final / item.price.original) * 100);
      await supabase.from('price_history').insert({
        game_id: inserted.id,
        price: item.price.final,
        discount_percent: discount,
      });
    }

    console.log(`✅ 추가됨: ${item.name} [${item.source}]`);
    byExternal.add(key);
    byName.set(norm(item.name), inserted);
    added++;
    await sleep(400);
  }

  console.log(`\n새로 추가 ${added}개, 기존 게임에 플랫폼 추가 ${merged}개`);
}

main();
