// scripts/enrich-hero-images.mjs
// 상세 페이지 맨 위용 가로로 긴 이미지(스팀 library_hero, 1920x620 약 3:1)를 찾아 hero_image_url에 저장
// 실행: node --env-file=.env.local scripts/enrich-hero-images.mjs                    (hero_image_url이 빈 게임만)
//       node --env-file=.env.local scripts/enrich-hero-images.mjs --retry-fallback   (library_hero를 못 찾아 카드·표지 이미지를 대신 넣은 게임 다시 찾기)
// - 새 게임은 이미지 주소에 해시가 붙어(apps/<id>/<해시>/library_hero.jpg) 짐작할 수 없어서 스팀 상점 API(IStoreBrowseService, 키 필요 없음)로 주소를 먼저 받음
// - --retry-fallback은 지금 값이 카드·표지 이미지와 같은(=대신 넣은) 게임만 바꿈. 다른 곳에서 넣은 이미지는 건드리지 않음
import { createClient } from '@supabase/supabase-js';
import { onlyIds } from './lib/only-ids.mjs';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const RETRY = process.argv.includes('--retry-fallback');
const STEAM_ASSETS = 'https://shared.akamai.steamstatic.com/store_item_assets/';

async function exists(url) {
  try {
    let res = await fetch(url, { method: 'HEAD' });
    if (res.status === 405) res = await fetch(url, { headers: { Range: 'bytes=0-0' } });
    return (res.status === 200 || res.status === 206) && (res.headers.get('content-type') || '').startsWith('image/');
  } catch {
    return false;
  }
}

// 스팀 상점 API가 알려주는 library_hero 주소 (해시 경로 포함). 없거나 실패하면 null
async function storeHero(appid) {
  try {
    const input = { ids: [{ appid: Number(appid) }], context: { country_code: 'KR' }, data_request: { include_assets: true } };
    const res = await fetch(`https://api.steampowered.com/IStoreBrowseService/GetItems/v1?input_json=${encodeURIComponent(JSON.stringify(input))}`);
    const a = (await res.json())?.response?.store_items?.[0]?.assets;
    return a?.library_hero && a.asset_url_format ? STEAM_ASSETS + a.asset_url_format.replace('${FILENAME}', a.library_hero) : null;
  } catch {
    return null;
  }
}

async function candidates(g) {
  const list = [];
  const fromStore = await storeHero(g.steam_appid);
  if (fromStore) list.push(fromStore);
  for (const u of [g.card_image_url, g.cover_image_url]) {
    if (u && /\/(header|capsule_616x353)[^/]*\.jpg/.test(u)) list.push(u.replace(/\/(header|capsule_616x353)[^/?]*\.jpg/, '/library_hero.jpg'));
  }
  list.push(`https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${g.steam_appid}/library_hero.jpg`);
  list.push(`https://cdn.akamai.steamstatic.com/steam/apps/${g.steam_appid}/library_hero.jpg`);
  return [...new Set(list)];
}

let query = supabase
  .from('games')
  .select('id, name, steam_appid, card_image_url, cover_image_url, hero_image_url').eq('hidden', false)
  .not('steam_appid', 'is', null);
query = RETRY ? query.not('hero_image_url', 'is', null).not('hero_image_url', 'like', '%library_hero%') : query.is('hero_image_url', null);
const { data: loaded, error } = await onlyIds(query);
if (error) { console.error('조회 실패:', error.message); process.exit(1); }
// --retry-fallback: 대신 넣은 값(카드·표지와 같은 주소)만 대상
const games = RETRY ? loaded.filter((g) => g.hero_image_url === g.card_image_url || g.hero_image_url === g.cover_image_url) : loaded;
console.log(`${RETRY ? 'library_hero 대신 다른 이미지가 들어간' : '상단 이미지 없는'} 스팀 게임 ${games.length}개 처리\n`);

let hi = 0, fallback = 0;
for (let i = 0; i < games.length; i += 6) {
  await Promise.all(games.slice(i, i + 6).map(async (g) => {
    let found = null;
    for (const url of await candidates(g)) if (await exists(url)) { found = url; break; }
    if (RETRY) {
      // 다시 찾아도 없으면 그대로 두고, 찾았으면 그사이 값이 안 바뀐 경우에만 바꿈
      if (found) await supabase.from('games').update({ hero_image_url: found }).eq('id', g.id).eq('hero_image_url', g.hero_image_url);
    } else {
      await supabase.from('games').update({ hero_image_url: found || g.card_image_url || g.cover_image_url }).eq('id', g.id);
    }
    found ? hi++ : fallback++;
    console.log(`${found ? '✅' : '➖'} ${g.name}`);
  }));
}
console.log(`\n완료 — 초고화질 ${hi}개, 기존 이미지 유지 ${fallback}개`);
