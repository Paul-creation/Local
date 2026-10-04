// scripts/fill-content-descriptors.mjs
// 스팀 content descriptors(성인 콘텐츠 표기)를 games.content_descriptor_ids에 채운다 (무료, AI 안 씀)
// - 1 일부 노출 또는 성적인 콘텐츠 · 2 빈번한 폭력 또는 유혈 · 3 성인 전용 성적인 콘텐츠
//   4 빈번한 노출 또는 성적인 콘텐츠 · 5 일반 성인용 콘텐츠  (화면 표기: app/lib/contentDescriptors.ts)
// - 표기가 없는 게임은 빈 배열({})로 저장해서 "확인했음"을 남긴다. null = 아직 확인 안 함
// - 이미 값이 있는 게임은 건너뛰고 덮어쓰지 않음. 스팀 앱 번호 없는 게임도 건너뜀
// - 받은 결과는 scripts/.cache/steam-descriptors.json에 저장 → 다시 실행할 때 스팀에 다시 묻지 않음
// - 새 게임은 bulk-import.mjs가 넣을 때 같이 채운다
// 실행: node --env-file=.env.local scripts/fill-content-descriptors.mjs   (미리보기)
//       node --env-file=.env.local scripts/fill-content-descriptors.mjs --apply
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { steamGet, appdetailsUrl, SteamLimitError } from './lib/steam.mjs';

const APPLY = process.argv.includes('--apply');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const CACHE = 'scripts/.cache/steam-descriptors.json';

async function main() {
  const cache = fs.existsSync(CACHE) ? JSON.parse(fs.readFileSync(CACHE, 'utf8')) : {};
  const save = () => { fs.mkdirSync('scripts/.cache', { recursive: true }); fs.writeFileSync(CACHE, JSON.stringify(cache, null, 1)); };

  const { data: todo, error } = await supabase
    .from('games')
    .select('id, name, steam_appid')
    .is('content_descriptor_ids', null)
    .not('steam_appid', 'is', null)
    .order('id');
  if (error) throw new Error(`게임 목록을 못 불러옴: ${error.message}`);
  console.log(`${APPLY ? '반영' : '미리보기'} — 채울 게임 ${todo.length}개\n`);

  let saved = 0, fetched = 0;
  const failed = [];
  for (const g of todo) {
    let entry = cache[g.steam_appid];
    if (!entry || entry.fail) {
      try {
        const res = (await steamGet(appdetailsUrl(g.steam_appid, 'english')))?.[g.steam_appid];
        entry = res?.success
          ? { id: g.id, name: g.name, ids: res.data.content_descriptors?.ids ?? [], notes: res.data.content_descriptors?.notes ?? null, required_age: res.data.required_age }
          : { id: g.id, name: g.name, fail: '스팀 상점 정보 없음' };
      } catch (e) {
        if (e instanceof SteamLimitError) { console.log(`⛔ ${e.message} — 여기까지 저장하고 멈춤`); break; }
        entry = { id: g.id, name: g.name, fail: e.message };
      }
      cache[g.steam_appid] = entry;
      fetched++;
      if (fetched % 25 === 0) save();
    }
    if (entry.fail) { failed.push(`${g.name} (${entry.fail})`); continue; }

    const ids = [...new Set(entry.ids.map(Number))].sort((a, b) => a - b);
    if (ids.length) console.log(`  ${g.name}: ${ids.join(', ')}`);
    if (APPLY) {
      // 그 사이 다른 곳에서 채웠으면 덮어쓰지 않게 null인 행만
      const { error: upErr } = await supabase.from('games').update({ content_descriptor_ids: ids }).eq('id', g.id).is('content_descriptor_ids', null);
      if (upErr) { failed.push(`${g.name} (저장 실패: ${upErr.message})`); continue; }
    }
    saved++;
  }
  save();

  console.log(`\n${APPLY ? '저장' : '저장할 게임'} ${saved}개 · 스팀에 새로 물어본 게임 ${fetched}개 · 실패 ${failed.length}개`);
  failed.forEach((f) => console.log(`  ⚠️ ${f}`));
  if (!APPLY) console.log('\n반영하려면 --apply');
}

main().catch((e) => { console.error(e.message); process.exit(1); });
