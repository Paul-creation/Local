import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// 너무 흔해서 변별력 없는 태그는 제외
const GENERIC = new Set([
  'indie', 'singleplayer', 'multiplayer', 'co-op', 'action', 'adventure',
  'early access', 'free to play', 'casual', 'pve', 'pvp', 'great soundtrack',
  '2d', '3d', 'steam achievements', 'steam trading cards', 'steam cloud',
]);

const TAG_KO = {
  'survival': '생존', 'crafting': '크래프팅', 'open world': '오픈월드',
  'zombies': '좀비', 'shooter': '슈팅', 'fps': 'FPS', 'racing': '레이싱',
  'sandbox': '샌드박스', 'building': '건축', 'simulation': '시뮬레이션',
  'strategy': '전략', 'rpg': 'RPG', 'moba': 'MOBA', 'sports': '스포츠',
  'battle royale': '배틀로얄', 'horror': '호러', 'physics': '물리엔진',
  'first-person': '1인칭', 'third person': '3인칭', 'team-based': '팀플레이',
  'competitive': '경쟁', 'tactical': '전술', 'fighting': '격투',
  'platformer': '플랫포머', 'puzzle': '퍼즐', 'exploration': '탐험',
  'driving': '운전', 'vehicular combat': '차량전투', 'military': '밀리터리',
  'war': '전쟁', 'space': '우주', 'post-apocalyptic': '포스트아포칼립스',
  'anime': '애니메이션풍', 'funny': '코미디', 'family friendly': '가족친화',
  'hero shooter': '히어로슈팅', 'looter shooter': '루터슈팅',
  'automobile sim': '차량시뮬', 'realistic': '리얼리즘', 'city builder': '도시건설',
};

async function main() {
  const { data: games, error } = await supabase
    .from('games')
    .select('id, name, steam_appid, tags').not('steam_appid', 'is', null);

  if (error) {
    console.error('조회 실패:', error.message);
    return;
  }

  for (const game of games) {
    if ((game.tags?.length || 0) >= 3) {
      console.log(`건너뜀 (이미 있음): ${game.name}`);
      continue;
    }

    const res = await fetch(`https://steamspy.com/api.php?request=appdetails&appid=${game.steam_appid}`);
    const json = await res.json();
    const tagEntries = Object.entries(json.tags || {});

    const sorted = tagEntries
      .sort((a, b) => b[1] - a[1])
      .map(([tag]) => tag)
      .filter((tag) => !GENERIC.has(tag.toLowerCase()));

    const top3 = sorted.slice(0, 3).map((tag) => TAG_KO[tag.toLowerCase()] || tag);

    if (top3.length === 0) {
      console.log(`태그 없음: ${game.name}`);
      continue;
    }

    const { error: updateError } = await supabase
      .from('games')
      .update({ tags: top3 })
      .eq('id', game.id);

    if (updateError) {
      console.error(`업데이트 실패 (${game.name}):`, updateError.message);
    } else {
      console.log(`${game.name}: [${top3.join(', ')}]`);
    }

    await new Promise((r) => setTimeout(r, 600));
  }
}

main();