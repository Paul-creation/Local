// scripts/enrich-hero-images.mjs
// 상세 페이지 맨 위용 초고화질 이미지(스팀 library_hero, 3840x1240)를 찾아 hero_image_url에 저장
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function exists(url) {
  try {
    let res = await fetch(url, { method: 'HEAD' });
    if (res.status === 405) res = await fetch(url, { headers: { Range: 'bytes=0-0' } });
    return (res.status === 200 || res.status === 206) && (res.headers.get('content-type') || '').startsWith('image/');
  } catch {
    return false;
  }
}

function candidates(g) {
  const list = [];
  for (const u of [g.card_image_url, g.cover_image_url]) {
    if (u && /\/(header|capsule_616x353)[^/]*\.jpg/.test(u)) list.push(u.replace(/\/(header|capsule_616x353)[^/?]*\.jpg/, '/library_hero.jpg'));
  }
  list.push(`https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${g.steam_appid}/library_hero.jpg`);
  list.push(`https://cdn.akamai.steamstatic.com/steam/apps/${g.steam_appid}/library_hero.jpg`);
  return [...new Set(list)];
}

const { data: games, error } = await supabase
  .from('games')
  .select('id, name, steam_appid, card_image_url, cover_image_url')
  .not('steam_appid', 'is', null)
  .is('hero_image_url', null);
if (error) { console.error('조회 실패:', error.message); process.exit(1); }
console.log(`상단 이미지 없는 스팀 게임 ${games.length}개 처리\n`);

let hi = 0, fallback = 0;
for (let i = 0; i < games.length; i += 6) {
  await Promise.all(games.slice(i, i + 6).map(async (g) => {
    let found = null;
    for (const url of candidates(g)) if (await exists(url)) { found = url; break; }
    await supabase.from('games').update({ hero_image_url: found || g.card_image_url || g.cover_image_url }).eq('id', g.id);
    found ? hi++ : fallback++;
    console.log(`${found ? '✅' : '➖'} ${g.name}`);
  }));
}
console.log(`\n완료 — 초고화질 ${hi}개, 기존 이미지 유지 ${fallback}개`);
