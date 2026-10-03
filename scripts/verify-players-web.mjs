// scripts/verify-players-web.mjs
// 인기 멀티 게임의 인원·협동 정보를 Sonnet + 웹 검색으로 확인해서, DB 값과 다른 것만 표로 보여줌 (DB는 고치지 않음)
// - 확인 항목: 최소 인원(min_players), 최대 인원(max_players), 온라인 협동(tags의 '온라인 협동'), 혼자 플레이(solo_playable)
// - 대상: lib/coop-targets.mjs와 같은 기준 (max_players 2 이상, 인기 순)
// - 결과는 scripts/.cache/verify-players.json에 쌓아서, 이미 확인한 게임은 다시 묻지 않음
// 실행: node --env-file=.env.local scripts/verify-players-web.mjs            (상위 10개)
//       node --env-file=.env.local scripts/verify-players-web.mjs --limit 200
//       node --env-file=.env.local scripts/verify-players-web.mjs --ids <id>,<id>   (지정한 게임만, 인기·인원 조건 없이)
// 비용: 게임당 약 $0.05~0.12 (Sonnet 토큰 + 웹 검색 최대 2회, 회당 $0.01)
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const LIMIT = Number(process.argv[process.argv.indexOf('--limit') + 1]) || 10;
const IDS = process.argv.includes('--ids') ? process.argv[process.argv.indexOf('--ids') + 1].split(',') : null;
const CACHE = 'scripts/.cache/verify-players.json';
const MODEL = 'claude-sonnet-5-5';
// 1M 토큰당 가격 (입력 $2, 출력 $10, 캐시 쓰기 1.25배, 캐시 읽기 $0.20) + 웹 검색 1회 $0.01
const costOf = (u) =>
  ((u.input_tokens || 0) * 2 + (u.cache_creation_input_tokens || 0) * 2.5 + (u.cache_read_input_tokens || 0) * 0.2 + (u.output_tokens || 0) * 10) / 1e6
  + (u.server_tool_use?.web_search_requests || 0) * 0.01;

async function getTargets() {
  const cols = 'id, name, release_date, developer, heat_rank, current_players, min_players, max_players, solo_playable, tags';
  if (IDS) {
    const { data, error } = await supabase.from('games').select(cols).in('id', IDS);
    if (error) throw new Error(`게임 목록을 못 불러옴: ${error.message}`);
    return data;
  }
  const { data, error } = await supabase
    .from('games')
    .select(cols)
    .gte('max_players', 2);
  if (error) throw new Error(`게임 목록을 못 불러옴: ${error.message}`);
  return data
    .filter((g) => g.heat_rank || g.current_players)
    .sort((a, b) => {
      if (a.heat_rank && b.heat_rank) return a.heat_rank - b.heat_rank;
      if (a.heat_rank) return -1;
      if (b.heat_rank) return 1;
      return (b.current_players || 0) - (a.current_players || 0);
    })
    .slice(0, LIMIT);
}

async function askSonnet(game) {
  const prompt = `PC 게임 "${game.name}"${game.developer ? ` (개발사 ${game.developer})` : ''}${game.release_date ? ` (출시 ${String(game.release_date).slice(0, 4)})` : ''}의 플레이 인원 정보를 웹에서 확인해줘. 공식 스토어 페이지(Steam 등)나 공식 사이트를 우선으로 봐.

- min_players: 게임을 시작할 수 있는 최소 인원 (혼자 할 수 있으면 1)
- max_players: 공식적으로 한 판(한 세션)에 같이 할 수 있는 최대 인원 (모드 제외, 모드 중 가장 큰 값)
- online_coop: 다른 사람과 온라인으로 같은 편이 되어 협동하는 플레이가 있는지 (대전만 있으면 false)
- solo_playable: 혼자서도 제대로 즐길 수 있는지 (봇·싱글 모드 포함, 멀티 대기열만 있으면 false)

확인이 안 된 항목은 null. 마지막에 JSON만 답해. 각 항목의 근거 URL을 sources에 넣어.
{"min_players": 1, "max_players": 4, "online_coop": true, "solo_playable": true, "sources": {"min_players": "https://...", "max_players": "https://...", "online_coop": "https://...", "solo_playable": "https://..."}, "note": "한 줄 메모"}`;

  const messages = [{ role: 'user', content: prompt }];
  const usage = { input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, server_tool_use: { web_search_requests: 0 } };
  // 서버 도구가 길어지면 pause_turn으로 멈춤 → 답을 그대로 붙여 다시 보내면 이어서 함
  for (let turn = 0; turn < 3; turn++) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'server-side-fallback-2026-07-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 8000,
        output_config: { effort: 'medium' },
        fallbacks: 'default', // 드물게 안전 판단으로 거절되면 서버가 다른 모델로 다시 시도
        tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 2 }],
        messages,
      }),
    });
    const json = await res.json();
    if (json.error) throw new Error(`HTTP ${res.status} ${json.error.message}`);
    const u = json.usage || {};
    for (const k of ['input_tokens', 'output_tokens', 'cache_creation_input_tokens', 'cache_read_input_tokens']) usage[k] += u[k] || 0;
    usage.server_tool_use.web_search_requests += u.server_tool_use?.web_search_requests || 0;
    if (json.stop_reason === 'pause_turn') { messages.push({ role: 'assistant', content: json.content }); continue; }
    if (json.stop_reason === 'refusal') throw new Error('모델이 답을 거절함');
    const text = (json.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('');
    return { text, usage, cost: costOf(usage) };
  }
  throw new Error('pause_turn이 계속됨');
}

// 답에서 {"min_players" ...} 객체를 괄호 짝을 맞춰 꺼냄 (뒤에 설명이 더 붙어도 괜찮게)
// sources 안에도 {"min_players": "https://..."}가 있으므로 sources가 들어 있는 바깥 객체만 인정
function parseAnswer(text) {
  for (let start = text.lastIndexOf('{"min_players"'); start >= 0; start = text.lastIndexOf('{"min_players"', start - 1)) {
    const obj = readObject(text, start);
    if (obj && 'sources' in obj) return obj;
  }
  throw new Error('답에 JSON이 없음');
}

function readObject(text, start) {
  let depth = 0, inStr = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inStr) { if (c === '\\') i++; else if (c === '"') inStr = false; continue; }
    if (c === '"') inStr = true;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) {
      try { return JSON.parse(text.slice(start, i + 1)); } catch { return null; }
    }
  }
  return null;
}

const show = (v) => (v === true ? '가능' : v === false ? '불가' : v == null ? '(없음)' : String(v));

function diffs(game, r) {
  const db = {
    min_players: game.min_players,
    max_players: game.max_players,
    online_coop: (game.tags || []).includes('온라인 협동'),
    solo_playable: game.solo_playable,
  };
  const label = { min_players: '최소 인원', max_players: '최대 인원', online_coop: '온라인 협동 (태그)', solo_playable: '혼자 플레이' };
  return Object.keys(db)
    .filter((k) => r[k] != null && r[k] !== db[k])
    .map((k) => ({ game: game.name, field: label[k], db: show(db[k]), found: show(r[k]), source: r.sources?.[k] || '' }));
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) return console.error('.env.local에 ANTHROPIC_API_KEY가 없어요');
  const cache = fs.existsSync(CACHE) ? JSON.parse(fs.readFileSync(CACHE, 'utf8')) : {};
  const targets = await getTargets();
  const save = () => { fs.mkdirSync('scripts/.cache', { recursive: true }); fs.writeFileSync(CACHE, JSON.stringify(cache, null, 2)); };
  // 원문은 저장됐는데 해석만 실패한 게임은 API를 다시 부르지 않고 원문으로 다시 해석
  for (const c of Object.values(cache)) {
    if (c.result || !c.text) continue;
    try { c.result = parseAnswer(c.text); } catch (e) { console.log(`❌ ${c.name}: ${e.message}`); }
  }
  save();
  const todo = targets.filter((g) => !cache[g.id]);
  console.log(`대상 ${targets.length}개 중 새로 확인할 게임 ${todo.length}개 (이미 확인 ${targets.length - todo.length}개)\n`);

  let spent = 0, done = 0;
  for (const g of todo) {
    try {
      const { text, usage, cost } = await askSonnet(g);
      // 비용이 든 답은 해석하기 전에 먼저 저장
      cache[g.id] = { name: g.name, checked_at: new Date().toISOString(), text, usage, cost };
      save();
      spent += cost; done++;
      cache[g.id].result = parseAnswer(text);
      save();
      console.log(`✅ ${g.name}: 입력 ${usage.input_tokens + usage.cache_read_input_tokens + usage.cache_creation_input_tokens} · 출력 ${usage.output_tokens} 토큰 · 검색 ${usage.server_tool_use.web_search_requests}회 · $${cost.toFixed(4)}`);
    } catch (e) {
      console.log(`❌ ${g.name}: ${e.message}`);
    }
  }

  const rows = targets.filter((g) => cache[g.id]?.result).flatMap((g) => diffs(g, cache[g.id].result));
  console.log(`\n## DB와 다른 값 (${rows.length}건)\n`);
  console.log('| 게임 | 항목 | DB 값 | 확인한 값 | 근거 출처 |\n|---|---|---|---|---|');
  for (const r of rows) console.log(`| ${r.game} | ${r.field} | ${r.db} | ${r.found} | ${r.source} |`);
  if (done) console.log(`\n이번 실행 비용 약 $${spent.toFixed(4)} (게임당 평균 $${(spent / done).toFixed(4)}) → 200개면 약 $${(spent / done * 200).toFixed(2)}`);
}

main().catch((e) => { console.error(`❌ ${e.message}`); process.exit(1); });
