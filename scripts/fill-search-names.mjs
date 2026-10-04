// scripts/fill-search-names.mjs
// "친구랑 하는 영상" 대상 게임에 한국 유저가 실제로 부르는 이름을 search_name_ko에 저장
// - 쉼표로 최대 3개 (예: "레데리2, 레드 데드 리뎀션 2, RDR2"). 첫 번째 이름은 영상 검색에, 전부는 메인 검색에 씀
// 실행: node --env-file=.env.local scripts/fill-search-names.mjs            (비어 있는 게임만)
//       node --env-file=.env.local scripts/fill-search-names.mjs --expand   (이름이 1개뿐인 게임에 별명 덧붙이기)
//       node --env-file=.env.local scripts/fill-search-names.mjs --all      (영상 대상뿐 아니라 이름이 비어 있는 전체 게임)
// - 이미 있는 이름은 지우거나 바꾸지 않고, 첫 번째 자리도 그대로 둔 채 뒤에만 덧붙임
// - 이름이 한국어인 게임은 그 이름이 첫 번째
// - Haiku에 50개씩 묶어서 물어봄 (50개 기준 약 1센트)
import { createClient } from '@supabase/supabase-js';
import { onlyIds } from './lib/only-ids.mjs';
import { getCoopTargets } from './lib/coop-targets.mjs';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const EXPAND = process.argv.includes('--expand');
const ALL = process.argv.includes('--all');
const MAX_NAMES = 3;
const BATCH = 50;
let totalCost = 0;

// app/lib/searchMatch.ts의 normalizeSearch와 같은 기준 (같은 이름이 두 번 들어가지 않게 비교할 때)
const norm = (s) => String(s || '').toLowerCase().replace(/[\s\p{P}\p{S}]/gu, '');
const clean = (s) => String(s || '').replace(/[™®©]/g, '').replace(/\s+/g, ' ').trim();

async function askKoreanNames(games) {
  const list = games.map((g, i) => `${i + 1}. ${g.name}`).join('\n');
  const prompt = `아래 게임들을 한국 유저들이 검색창에 실제로 치는 이름을 게임마다 최대 ${MAX_NAMES}개 알려줘. 자주 쓰는 순서대로.
- 한국에서 흔히 쓰는 한글 이름, 줄임말, 별명 (예: Red Dead Redemption 2 → 레데리2, 레드 데드 리뎀션 2 / Lethal Company → 리썰 컴퍼니, 리썰 / Left 4 Dead 2 → 레포데2, 레프트 포 데드 2)
- 한국에서 흔히 쓰는 영어 줄임말이 있으면 포함 가능 (예: GTA5, RDR2)
- 원래 영어 이름을 그대로 다시 쓰지는 마. ™ ® 같은 기호와 에디션 이름(Complete Edition, GOTY 등)은 빼
- 확실하지 않은 별명은 지어내지 마. 하나만 확실하면 하나만

게임 목록:
${list}

번호 순서대로 JSON으로만 답해. 설명이나 코드블록은 쓰지 마.
{"names": [{"index": 1, "names": ["리썰 컴퍼니", "리썰"]}]}`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  const json = await res.json();
  if (json.error) throw new Error(`HTTP ${res.status} ${json.error.message}`);
  const text = (json.content || []).map((c) => c.text || '').join('');
  if (json.stop_reason === 'max_tokens') throw new Error('답이 중간에 잘림 (max_tokens)');
  const parsed = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
  const u = json.usage || {};
  const cost = (u.input_tokens || 0) / 1e6 + (u.output_tokens || 0) * 5 / 1e6;
  totalCost += cost;
  console.log(`Haiku 사용: 입력 ${u.input_tokens} · 출력 ${u.output_tokens} 토큰 (약 $${cost.toFixed(4)})\n`);
  return games.map((g, i) => {
    const row = parsed.names?.find((n) => Number(n.index) === i + 1);
    return (Array.isArray(row?.names) ? row.names : [row?.name]).map(clean).filter(Boolean);
  });
}

// 원래 이름들을 앞에 그대로 두고, 새 이름 중 겹치지 않는 것만 뒤에 붙여 최대 3개
function merge(existing, extra, gameName) {
  const out = [];
  const seen = new Set([norm(gameName)]); // 영어 원래 이름은 메인 검색에서 이미 찾아지므로 빼
  for (const n of [...existing, ...extra]) {
    const key = norm(n);
    if (!key || (seen.has(key) && !existing.includes(n))) continue;
    if (out.some((o) => norm(o) === key)) continue;
    seen.add(key);
    out.push(n);
  }
  return out.slice(0, Math.max(MAX_NAMES, existing.length));
}

async function getAllGames() {
  const { data, error } = await onlyIds(supabase.from('games').select('id, name, search_name_ko').eq('hidden', false).order('id'));
  if (error) throw new Error(`게임 목록을 못 불러옴: ${error.message}`);
  return data;
}

async function main() {
  const targets = ALL ? await getAllGames() : await getCoopTargets(supabase, 'search_name_ko');
  const todo = targets.filter((g) => !g.search_name_ko || (EXPAND && !g.search_name_ko.includes(',')));
  console.log(`대상 ${targets.length}개 중 ${EXPAND ? '이름이 없거나 1개뿐인' : '한국어 이름이 없는'} 게임 ${todo.length}개 처리\n`);
  if (!todo.length) return;
  if (!process.env.ANTHROPIC_API_KEY) return console.error('.env.local에 ANTHROPIC_API_KEY가 없어요');

  let saved = 0, same = 0, failed = 0;
  for (let b = 0; b < todo.length; b += BATCH) {
    const chunk = todo.slice(b, b + BATCH);
    console.log(`--- ${b + 1}~${b + chunk.length} / ${todo.length} ---`);
    let suggested;
    try { suggested = await askKoreanNames(chunk); }
    catch (e) { console.log(`❌ 이 묶음 실패 (다음 실행 때 다시 처리): ${e.message}\n`); failed += chunk.length; continue; }
    const r = await saveNames(chunk, suggested);
    saved += r.saved; same += r.same;
  }
  console.log(`\n완료 — 저장 ${saved}개 · 그대로 ${same}개${failed ? ` · 실패 ${failed}개` : ''} · Haiku 비용 약 $${totalCost.toFixed(4)}`);
}

async function saveNames(todo, suggested) {
  let saved = 0, same = 0;
  for (const [i, g] of todo.entries()) {
    const existing = g.search_name_ko
      ? g.search_name_ko.split(',').map((s) => s.trim()).filter(Boolean)
      : /[가-힣]/.test(g.name) ? [clean(g.name)] : [];
    const names = merge(existing, suggested[i], g.name);
    const value = names.join(', ');
    if (!value || value === g.search_name_ko) { same++; continue; }
    // 처리하는 동안 다른 곳에서 값이 바뀌었으면 건드리지 않음
    let q = supabase.from('games').update({ search_name_ko: value }).eq('id', g.id);
    q = g.search_name_ko ? q.eq('search_name_ko', g.search_name_ko) : q.is('search_name_ko', null);
    const { error } = await q;
    if (error) { console.log(`❌ ${g.name}: ${error.message}`); continue; }
    saved++;
    console.log(`✅ ${g.name}: ${g.search_name_ko || '(없음)'} → ${value}`);
  }
  return { saved, same };
}

main().catch((e) => { console.error(`❌ ${e.message}`); process.exit(1); });
