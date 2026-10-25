// scripts/enrich-cover-vertical.mjs
// 상세 페이지 세로 표지(스팀 library_600x900, 2:3)가 실제로 있는지 확인해 cover_vertical_url에 저장
// 실행: node --env-file=.env.local scripts/enrich-cover-vertical.mjs           (미리보기, 저장 안 함)
//       node --env-file=.env.local scripts/enrich-cover-vertical.mjs --apply   (cover_vertical_url이 빈 스팀 게임만 저장)
// - 스팀 상점 API(IStoreBrowseService, 키 필요 없음)가 알려주는 주소를 먼저 쓰고(새 게임은 해시 경로), 없으면 표준 주소(apps/<id>/library_600x900.jpg)를 확인
// - 이미지가 없으면 빈 문자열('')을 저장해 "없음 확인됨"으로 두고 다음부터 건너뜀 (상세는 '' 이면 가로 이미지를 씀). 다시 확인하려면 --retry-missing
// - 이미 값이 있는 게임은 건드리지 않음
import { createClient } from '@supabase/supabase-js';
import { onlyIds } from './lib/only-ids.mjs';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const APPLY = process.argv.includes('--apply');
const RETRY = process.argv.includes('--retry-missing');
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

async function storeCover(appid) {
  try {
    const input = { ids: [{ appid: Number(appid) }], context: { country_code: 'KR' }, data_request: { include_assets: true } };
    const res = await fetch(`https://api.steampowered.com/IStoreBrowseService/GetItems/v1?input_json=${encodeURIComponent(JSON.stringify(input))}`);
    const a = (await res.json())?.response?.store_items?.[0]?.assets;
    return a?.library_capsule && a.asset_url_format ? STEAM_ASSETS + a.asset_url_format.replace('${FILENAME}', a.library_capsule) : null;
  } catch {
    return null;
  }
}

let query = supabase.from('games').select('id, name, steam_appid').eq('hidden', false).not('steam_appid', 'is', null);
query = RETRY ? query.eq('cover_vertical_url', '') : query.is('cover_vertical_url', null);
const { data: games, error } = await onlyIds(query);
if (error) { console.error('조회 실패:', error.message); process.exit(1); }
console.log(`${RETRY ? '세로 표지 없음으로 표시된' : '세로 표지 확인 안 한'} 스팀 게임 ${games.length}개 처리${APPLY ? '' : ' (미리보기)'}\n`);

let found = 0, missing = 0, failed = 0;
for (let i = 0; i < games.length; i += 6) {
  await Promise.all(games.slice(i, i + 6).map(async (g) => {
    let url = null;
    const fromStore = await storeCover(g.steam_appid);
    if (fromStore && await exists(fromStore)) url = fromStore;
    else {
      const std = `${STEAM_ASSETS}steam/apps/${g.steam_appid}/library_600x900.jpg`;
      if (await exists(std)) url = std;
    }
    if (url) found++; else missing++;
    if (APPLY) {
      // 그사이 값이 들어온 게임은 덮어쓰지 않음
      const q = supabase.from('games').update({ cover_vertical_url: url ?? '' }).eq('id', g.id);
      const { error: e } = await (RETRY ? q.eq('cover_vertical_url', '') : q.is('cover_vertical_url', null));
      if (e) { failed++; console.error(`저장 실패 (${g.name}):`, e.message); }
    }
  }));
  if ((i / 6) % 20 === 19) console.log(`  ${Math.min(i + 6, games.length)}/${games.length}`);
}
console.log(`\n완료 — 세로 표지 있음 ${found}개, 없음 ${missing}개${failed ? `, 저장 실패 ${failed}개` : ''}${APPLY ? '' : ' (저장 안 함)'}`);
