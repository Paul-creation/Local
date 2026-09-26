// scripts/enrich-other-stores.mjs
// 스팀이 아닌 게임(에픽·블리자드·라이엇)만 데이터 채우기
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const norm = (s = '') => s.toLowerCase().replace(/[^a-z0-9가-힣]/g, '');

const CURATED = {
  'riot:league-of-legends':     { min: 1, max: 5,  difficulty: '어려움', category: '협동', tags: ['e스포츠', '경쟁', '전술'] },
  'riot:valorant':              { min: 1, max: 5,  difficulty: '어려움', category: '협동', tags: ['FPS', 'e스포츠', '전술'] },
  'riot:teamfight-tactics':     { min: 1, max: 8,  difficulty: '보통',   category: '파티', tags: ['전술', '경쟁', '캐주얼'] },
  'riot:legends-of-runeterra':  { min: 1, max: 2,  difficulty: '보통',   category: '협동', tags: ['카드 게임', '전술', '경쟁'] },
  'riot:2xko':                  { min: 1, max: 2,  difficulty: '어려움', category: '협동', tags: ['격투', '경쟁', 'e스포츠'] },
  'battlenet:overwatch-2':      { min: 1, max: 5,  difficulty: '보통',   category: '협동', tags: ['FPS', '경쟁', 'e스포츠'] },
  'battlenet:diablo-iv':        { min: 1, max: 4,  difficulty: '보통',   category: '협동', tags: ['액션 RPG', '핵앤슬래시', '다크 판타지'] },
  'battlenet:diablo-ii-resurrected': { min: 1, max: 8, difficulty: '보통', category: '협동', tags: ['액션 RPG', '핵앤슬래시', '다크 판타지'] },
  'battlenet:diablo-iii':       { min: 1, max: 4,  difficulty: '쉬움',   category: '협동', tags: ['액션 RPG', '핵앤슬래시', '루팅'] },
  'battlenet:hearthstone':      { min: 1, max: 2,  difficulty: '쉬움',   category: '파티', tags: ['카드 게임', '경쟁', '캐주얼'] },
  'battlenet:heroes-of-the-storm': { min: 1, max: 5, difficulty: '보통', category: '협동', tags: ['경쟁', '전술', '캐주얼'] },
  'battlenet:starcraft-ii':     { min: 1, max: 8,  difficulty: '어려움', category: '협동', tags: ['전술', 'e스포츠', '우주'] },
  'battlenet:starcraft-remastered': { min: 1, max: 8, difficulty: '어려움', category: '협동', tags: ['전술', 'e스포츠', '우주'] },
  'battlenet:world-of-warcraft': { min: 1, max: 40, difficulty: '보통',  category: '협동', tags: ['MMORPG', '대규모 멀티', '오픈월드'] },
  'battlenet:warcraft-iii-reforged': { min: 1, max: 12, difficulty: '어려움', category: '협동', tags: ['전술', '경쟁', '다크 판타지'] },
  'epic:fortnite':              { min: 1, max: 4,  difficulty: '보통',   category: '협동', tags: ['배틀로얄', '슈팅', '캐주얼'] },
  'epic:fall-guys':             { min: 1, max: 4,  difficulty: '쉬움',   category: '파티', tags: ['파티 게임', '배틀로얄', '캐주얼'] },
  'epic:alan-wake-2':           { min: 1, max: 1,  difficulty: '보통',   category: '서바이벌', tags: ['서바이벌 호러', '심리 공포', '스토리 풍부'] },
};

const IGDB_TAG = {
  'Shooter': '슈팅', 'Role-playing (RPG)': 'RPG', 'Fighting': '격투', 'Puzzle': '퍼즐',
  'Platform': '플랫포머', 'Strategy': '전술', 'Real Time Strategy (RTS)': '전술',
  'Turn-based strategy (TBS)': '전술', 'Tactical': '전술', "Hack and slash/Beat 'em up": '핵앤슬래시',
  'Card & Board Game': '카드 게임', 'Sport': '스포츠', 'Racing': '운전', 'Simulator': '시뮬레이션',
  'Horror': '호러', 'Survival': '생존', 'Open world': '오픈월드', 'Sandbox': '샌드박스',
  'Science fiction': '우주', 'Warfare': '밀리터리', 'Comedy': '코미디', 'Party': '파티 게임',
  'Fantasy': '다크 판타지', 'Stealth': '전술', 'Drama': '스토리 풍부', 'Mystery': '스토리 풍부',
  'Adventure': '탐험', 'Arcade': '캐주얼', 'Indie': '캐주얼',
};

function guessCategory(tags = [], genres = []) {
  const all = [...tags, ...genres].join(' ').toLowerCase();
  if (all.includes('생존') || all.includes('호러') || all.includes('survival')) return '서바이벌';
  if (all.includes('퍼즐') || all.includes('puzzle')) return '퍼즐';
  if (all.includes('파티') || all.includes('party')) return '파티';
  return '협동';
}

async function getIgdbToken() {
  const res = await fetch(
    `https://id.twitch.tv/oauth2/token?client_id=${process.env.IGDB_CLIENT_ID}&client_secret=${process.env.IGDB_CLIENT_SECRET}&grant_type=client_credentials`,
    { method: 'POST' }
  );
  return (await res.json()).access_token;
}

async function searchIgdb(query, token) {
  const res = await fetch('https://api.igdb.com/v4/games', {
    method: 'POST',
    headers: { 'Client-ID': process.env.IGDB_CLIENT_ID, Authorization: `Bearer ${token}`, Accept: 'application/json' },
    body: `fields name, genres.name, themes.name, game_modes.name, aggregated_rating,
      involved_companies.developer, involved_companies.publisher, involved_companies.company.name,
      multiplayer_modes.onlinecoopmax, multiplayer_modes.onlinemax,
      multiplayer_modes.offlinecoopmax, multiplayer_modes.offlinemax;
      search "${query.replace(/"/g, '')}"; limit 5;`,
  });
  const list = await res.json();
  if (!Array.isArray(list) || list.length === 0) return null;
  return list.find((g) => norm(g.name) === norm(query)) || list[0];
}

async function main() {
  const { data: games, error } = await supabase
    .from('games')
    .select('id, name, source, external_id, tags, genres, themes, min_players, max_players, difficulty, category, developer, publisher, critic_score')
    .is('steam_appid', null);
  if (error) return console.error('조회 실패:', error.message);

  console.log(`스팀 외 게임 ${games.length}개 처리 시작\n`);
  const token = await getIgdbToken().catch(() => null);
  if (!token) console.log('⚠️ IGDB 토큰 실패 — 직접 지정한 게임만 채움');

  for (const game of games) {
    const update = {};
    const curated = CURATED[`${game.source}:${game.external_id}`];

    let ig = null;
    if (token) {
      ig = await searchIgdb(game.name, token);
      if (!ig && game.external_id) ig = await searchIgdb(game.external_id.replace(/-/g, ' '), token);
      await sleep(300);
    }

    if (ig) {
      const genres = ig.genres?.map((g) => g.name) || [];
      const themes = ig.themes?.map((t) => t.name) || [];
      if (!game.genres?.length && genres.length) update.genres = genres;
      if (!game.themes?.length && themes.length) update.themes = themes;
      if (!game.critic_score && ig.aggregated_rating) update.critic_score = Math.round(ig.aggregated_rating);
      const dev = ig.involved_companies?.find((c) => c.developer)?.company?.name;
      const pub = ig.involved_companies?.find((c) => c.publisher)?.company?.name;
      if (!game.developer && dev) update.developer = dev;
      if (!game.publisher && pub) update.publisher = pub;
    }

    if (curated) {
      update.tags = curated.tags;
      update.min_players = curated.min;
      update.max_players = curated.max;
      update.difficulty = curated.difficulty;
      update.category = curated.category;
    } else {
      if ((game.tags?.length || 0) < 3 && ig) {
        const src = [...(ig.genres || []), ...(ig.themes || [])].map((x) => IGDB_TAG[x.name]).filter(Boolean);
        const tags = Array.from(new Set(src)).slice(0, 3);
        if (tags.length) update.tags = tags;
      }
      if (!game.min_players) {
        const m = ig?.multiplayer_modes || [];
        const max = Math.max(1, ...m.flatMap((x) => [x.onlinecoopmax, x.onlinemax, x.offlinecoopmax, x.offlinemax]).filter(Boolean));
        update.min_players = 1;
        update.max_players = max;
      }
      if (!game.difficulty) update.difficulty = '보통';
      if (!game.category) update.category = guessCategory(update.tags || game.tags || [], update.genres || game.genres || []);
    }

    if (Object.keys(update).length === 0) {
      console.log(`건너뜀 (이미 채워짐): ${game.name}`);
      continue;
    }

    const { error: upErr } = await supabase.from('games').update(update).eq('id', game.id);
    if (upErr) console.error(`❌ 실패 (${game.name}):`, upErr.message);
    else
      console.log(
        `✅ ${game.name} ${curated ? '[지정]' : ig ? '[IGDB]' : '[기본값]'} — ` +
        `${update.min_players ?? game.min_players}-${update.max_players ?? game.max_players}인 · ` +
        `${(update.tags || game.tags || []).join(', ')}`
      );
  }
  console.log('\n완료');
}

main();
