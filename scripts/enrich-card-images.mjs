// scripts/enrich-card-images.mjs
// 스팀 게임의 고화질 카드 이미지(616x353)를 찾아 card_image_url에 저장
// 실행: node --env-file=.env.local scripts/enrich-card-images.mjs                    (card_image_url이 빈 게임만)
//       node --env-file=.env.local scripts/enrich-card-images.mjs --retry-fallback   (616x353을 못 찾아 표지 이미지를 대신 넣은 게임 다시 찾기)
// - 새 게임은 이미지 주소에 해시가 붙어(apps/<id>/<해시>/capsule_616x353.jpg) 짐작할 수 없어서 스팀 상점 API(IStoreBrowseService, 키 필요 없음)로 주소를 먼저 받음
//   상점 API는 lib/steam.mjs(요청 간격 2초 + 429 재시도)로 부르고, 게임은 하나씩 차례로 처리
import { createClient } from '@supabase/supabase-js';
import { onlyIds } from './lib/only-ids.mjs';
import { steamGet } from './lib/steam.mjs';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
const RETRY = process.argv.includes('--retry-fallback');
const STEAM_ASSETS = 'https://shared.akamai.steamstatic.com/store_item_assets/';

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

// 스팀 상점 API가 알려주는 main_capsule(616x353) 주소 (해시 경로 포함). 없거나 실패하면 null
async function storeCapsule(appid) {
  try {
    const input = { ids: [{ appid: Number(appid) }], context: { country_code: 'KR' }, data_request: { include_assets: true } };
    const json = await steamGet(`https://api.steampowered.com/IStoreBrowseService/GetItems/v1?input_json=${encodeURIComponent(JSON.stringify(input))}`);
    const a = json?.response?.store_items?.[0]?.assets;
    return a?.main_capsule && a.asset_url_format ? STEAM_ASSETS + a.asset_url_format.replace('${FILENAME}', a.main_capsule) : null;
  } catch {
    return null;
  }
}

async function candidates(game) {
  const list = [];
  const fromStore = await storeCapsule(game.steam_appid);
  if (fromStore) list.push(fromStore);
  if (game.cover_image_url && /header(_[a-z]+)?\.jpg/.test(game.cover_image_url)) {
    list.push(game.cover_image_url.replace(/header(_[a-z]+)?\.jpg/, 'capsule_616x353.jpg'));
  }
  list.push(`https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${game.steam_appid}/capsule_616x353.jpg`);
  list.push(`https://cdn.akamai.steamstatic.com/steam/apps/${game.steam_appid}/capsule_616x353.jpg`);
  return [...new Set(list)];
}

async function main() {
  const { data: loaded, error } = await onlyIds(supabase
    .from('games')
    .select('id, name, steam_appid, cover_image_url, card_image_url').eq('hidden', false)
    .not('steam_appid', 'is', null)
    .filter('card_image_url', RETRY ? 'not.is' : 'is', null));
  if (error) return console.error('조회 실패:', error.message);
  // --retry-fallback: 대신 넣은 값(표지와 같은 주소)만 대상
  const games = RETRY ? loaded.filter((g) => g.card_image_url === g.cover_image_url) : loaded;
  console.log(`${RETRY ? '616x353 대신 표지 이미지가 들어간' : '카드 이미지 없는'} 스팀 게임 ${games.length}개 처리\n`);

  let hi = 0, fallback = 0, changed = 0;
  for (const [i, game] of games.entries()) {
    let found = null;
    for (const url of await candidates(game)) {
      if (await exists(url)) { found = url; break; }
    }
    if (RETRY) {
      // 다시 찾아도 없으면 그대로 두고, 찾았으면 그사이 값이 안 바뀐 경우에만 바꿈
      if (found) {
        const { count } = await supabase.from('games').update({ card_image_url: found }, { count: 'exact' }).eq('id', game.id).eq('card_image_url', game.card_image_url);
        changed += count ?? 0;
      }
    } else {
      await supabase.from('games').update({ card_image_url: found || game.cover_image_url }).eq('id', game.id);
      changed++;
    }
    if (found) hi++; else fallback++;
    console.log(`[${i + 1}/${games.length}] ${found ? '✅' : '➖'} ${game.name}`);
  }
  console.log(`\n완료 — 고화질 ${hi}개, 기존 이미지 유지 ${fallback}개 · 저장한 행 ${changed}개`);
}

main();
