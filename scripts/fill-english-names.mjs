// scripts/fill-english-names.mjs
// 이름이 한국어인 게임에 스팀 영어 이름을 search_name_ko 뒤에 덧붙임 (메인·비교·커뮤니티 검색에서 "mimesis"로 찾히게)
// 실행: node --env-file=.env.local scripts/fill-english-names.mjs           (미리보기만, DB 변경 없음)
//       node --env-file=.env.local scripts/fill-english-names.mjs --apply   (저장)
// - 한국어 이름이 첫 번째 자리를 유지하고 영어 이름은 맨 뒤에만 붙임, 이미 있는 값은 지우거나 바꾸지 않음
// - 이미 영어 이름이 들어 있는 게임은 건너뜀 (다시 실행해도 같은 게임을 두 번 처리하지 않음)
// - AI 호출 없음. 스팀 appdetails(l=english)만 사용
import { createClient } from '@supabase/supabase-js';
import { onlyIds } from './lib/only-ids.mjs';

const APPLY = process.argv.includes('--apply');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// app/lib/searchMatch.ts의 normalizeSearch와 같은 기준
const norm = (s) => String(s || '').toLowerCase().replace(/[\s\p{P}\p{S}]/gu, '');
const clean = (s) => String(s || '').replace(/[™®©]/g, '').replace(/\s+/g, ' ').trim();
// 스팀이 영어 이름을 주지 않는 게임의 수동 영어 이름 (steam_appid → 이름)
const MANUAL = { 1825750: 'SoulWorker' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function englishName(appid) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(`https://store.steampowered.com/api/appdetails?appids=${appid}&l=english&filters=basic`);
    if (res.status === 429) { await sleep(30000 * (attempt + 1)); continue; }
    if (!res.ok) return null;
    const json = await res.json();
    const d = json?.[appid];
    return d?.success ? clean(d.data?.name) : null;
  }
  return null;
}

async function main() {
  const { data, error } = await onlyIds(supabase.from('games').select('id, name, steam_appid, search_name_ko').eq('hidden', false).order('id'));
  if (error) throw new Error(`게임 목록을 못 불러옴: ${error.message}`);
  const korean = data.filter((g) => /[가-힣]/.test(g.name));
  // 이름이나 별명에 영문자가 이미 있으면 영어로도 찾히는 게임이라 건너뜀
  const todo = korean.filter((g) => g.steam_appid && !/[a-z]/i.test(`${g.name} ${g.search_name_ko || ''}`));
  const noAppid = korean.filter((g) => !g.steam_appid && !/[a-z]/i.test(`${g.name} ${g.search_name_ko || ''}`));
  console.log(`한국어 이름 ${korean.length}개 중 영어로 안 찾히는 게임 ${todo.length + noAppid.length}개 (스팀 ID 없음 ${noAppid.length}개는 제외) — ${APPLY ? '저장' : '미리보기'}\n`);

  let saved = 0, same = 0, failed = 0;
  for (const g of todo) {
    const en = (await englishName(g.steam_appid)) || MANUAL[g.steam_appid] || null;
    await sleep(1500);
    if (!en) { failed++; console.log(`⚠️ ${g.name} (${g.steam_appid}): 영어 이름을 못 받음`); continue; }
    const existing = g.search_name_ko ? g.search_name_ko.split(',').map((s) => s.trim()).filter(Boolean) : [clean(g.name)];
    if (existing.some((n) => norm(n) === norm(en))) { same++; continue; }
    const value = [...existing, en].join(', ');
    if (!APPLY) { saved++; console.log(`🔍 ${g.name}: ${g.search_name_ko || '(없음)'} → ${value}`); continue; }
    // 처리하는 동안 다른 곳에서 값이 바뀌었으면 건드리지 않음
    let q = supabase.from('games').update({ search_name_ko: value }).eq('id', g.id);
    q = g.search_name_ko ? q.eq('search_name_ko', g.search_name_ko) : q.is('search_name_ko', null);
    const { error: e } = await q;
    if (e) { console.log(`❌ ${g.name}: ${e.message}`); failed++; continue; }
    saved++;
    console.log(`✅ ${g.name}: ${g.search_name_ko || '(없음)'} → ${value}`);
  }
  console.log(`\n완료 — ${APPLY ? '저장' : '저장 예정'} ${saved}개 · 그대로 ${same}개 · 실패 ${failed}개`);
}

main().catch((e) => { console.error(`❌ ${e.message}`); process.exit(1); });
