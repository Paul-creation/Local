// scripts/enrich-card-images.mjs
// 스팀 게임의 고화질 카드 이미지(616x353)를 찾아 card_image_url에 저장
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function exists(url) {
  try {
    let res = await fetch(url, { method: 'HEAD' });
    if (res.status === 405) res = await fetch(url, { headers: { Range: 'bytes=0-0' } });
    const type = res.headers.get('content-type') || '';
    return (res.status === 200 || res.status === 206) && type.startsWith('image/');
  } catch {
    return false;
  }
}

function candidates(game) {
  const list = [];
  if (game.cover_image_url && /header(_[a-z]+)?\.jpg/.test(game.cover_image_url)) {
    list.push(game.cover_image_url.replace(/header(_[a-z]+)?\.jpg/, 'capsule_616x353.jpg'));
  }
  list.push(`https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${game.steam_appid}/capsule_616x353.jpg`);
  list.push(`https://cdn.akamai.steamstatic.com/steam/apps/${game.steam_appid}/capsule_616x353.jpg`);
  return [...new Set(list)];
}

async function main() {
  const { data: games, error } = await supabase
    .from('games')
    .select('id, name, steam_appid, cover_image_url')
    .not('steam_appid', 'is', null)
    .is('card_image_url', null);
  if (error) return console.error('조회 실패:', error.message);
  console.log(`카드 이미지 없는 스팀 게임 ${games.length}개 처리\n`);

  let hi = 0, fallback = 0;
  for (let i = 0; i < games.length; i += 6) {
    await Promise.all(games.slice(i, i + 6).map(async (game) => {
      let found = null;
      for (const url of candidates(game)) {
        if (await exists(url)) { found = url; break; }
      }
      const card = found || game.cover_image_url;
      await supabase.from('games').update({ card_image_url: card }).eq('id', game.id);
      if (found) hi++; else fallback++;
      console.log(`${found ? '✅' : '➖'} ${game.name}`);
    }));
  }
  console.log(`\n완료 — 고화질 ${hi}개, 기존 이미지 유지 ${fallback}개`);
}

main();
