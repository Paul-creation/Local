// scripts/list-players-pending.mjs
// "인원 검증 대기" 목록 — 노출 게임(hidden=false) 중 max_players가 빈 게임을 뽑아 scripts/.cache/pending-players.json에 저장 (DB 쓰기·AI 호출 없음)
// - 게임마다 스팀 영어 카테고리(싱글/멀티 구분), 현재 접속자·순위, IGDB 최대 인원 "후보값"을 함께 담는다. 후보값은 참고용이며 DB에 쓰지 않는다
//   인원은 이 목록을 보고 직접 검증해 결정 파일(data/verification/*.json)로 만들고 apply-verified-players.mjs로 넣는다 (기준: docs/verification-rules.md)
// - 스팀 카테고리는 scripts/.cache/steam-categories.json(fill-steam-categories와 같은 파일)에 있으면 그대로 쓰고, 없으면 appdetails로 받는다 (요청 간격 2초, 한 번에 최대 --max-steam개, 기본 300)
// - IGDB는 스팀 앱 ID로만 찾는다(후보 신뢰). 스팀 앱 ID가 없는 게임만 이름 검색(limit 1)이고 igdb_via에 "name"으로 표시
// - 매주 갱신 workflow가 이 파일을 아티팩트로 올린다 (scripts/.cache가 숨김 폴더라 include-hidden-files)
// 실행: node --env-file=.env.local scripts/list-players-pending.mjs
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { steamGet, appdetailsUrl, SteamLimitError } from './lib/steam.mjs';
import { getIgdbToken, igdbQuery, steamLookupBody, candidateMax } from './lib/igdb.mjs';
import { buildRow, sortPending } from './lib/players-pending.mjs';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const CAT_CACHE = 'scripts/.cache/steam-categories.json';
const OUT = 'scripts/.cache/pending-players.json';
const maxArg = process.argv.find((a) => a.startsWith('--max-steam='));
const MAX_STEAM = maxArg ? Number(maxArg.slice(12)) : 300;
const MODES = 'multiplayer_modes.onlinecoopmax, multiplayer_modes.offlinecoopmax, multiplayer_modes.onlinemax';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function loadPending() {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('games')
      .select('id, name, steam_appid, min_players, current_players, heat_rank')
      .eq('hidden', false).is('max_players', null).order('id').range(from, from + 999);
    if (error) throw new Error(`게임 목록을 못 불러옴: ${error.message}`);
    rows.push(...data);
    if (data.length < 1000) return rows;
  }
}

async function steamCategories(games) {
  const cache = fs.existsSync(CAT_CACHE) ? JSON.parse(fs.readFileSync(CAT_CACHE, 'utf8')) : {};
  const result = new Map();
  let fetched = 0;
  let stopped = false;
  for (const g of games) {
    if (!g.steam_appid) continue;
    const hit = cache[g.steam_appid]?.categories;
    if (hit) { result.set(g.id, hit); continue; }
    if (stopped || fetched >= MAX_STEAM) continue;
    try {
      const json = await steamGet(appdetailsUrl(g.steam_appid, 'english'));
      const d = json?.[g.steam_appid];
      fetched++;
      if (d?.success) result.set(g.id, (d.data.categories || []).map((c) => c.description));
    } catch (e) {
      if (e instanceof SteamLimitError) { stopped = true; console.log(`⛔ ${e.message} — 남은 게임의 스팀 카테고리는 비워 둠`); } else console.log(`❌ ${g.name}: ${e.message}`);
    }
  }
  console.log(`스팀 카테고리: 캐시 ${result.size - fetched}개 · 새로 받음 ${fetched}개`);
  return result;
}

async function igdbCandidate(game, token) {
  try {
    let ig = null;
    let via = null;
    if (game.steam_appid) {
      const data = await igdbQuery('external_games', steamLookupBody(game.steam_appid, `game.name, game.${MODES.replaceAll(', ', ', game.')}`), token);
      ig = data[0]?.game || null;
      via = 'appid';
    } else {
      const data = await igdbQuery('games', `fields name, ${MODES}; search "${game.name.replace(/"/g, '')}"; limit 1;`, token);
      ig = data[0] || null;
      via = 'name';
    }
    return ig ? { name: ig.name, via, max: candidateMax(ig.multiplayer_modes) } : null;
  } catch (e) {
    console.log(`IGDB 실패 (${game.name}): ${e.message}`);
    return null;
  }
}

async function main() {
  const games = await loadPending();
  console.log(`노출 게임 중 최대 인원이 빈 게임 ${games.length}개`);
  const cats = await steamCategories(games);

  const token = await getIgdbToken();
  if (!token) console.log('IGDB 토큰 발급 실패 — 후보값 없이 저장');
  const rows = [];
  for (const g of games) {
    const igdb = token ? await igdbCandidate(g, token) : null;
    if (token) await sleep(300);
    rows.push(buildRow(g, cats.get(g.id) ?? null, igdb));
  }
  const sorted = sortPending(rows);

  fs.mkdirSync('scripts/.cache', { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify({ generated_at: new Date().toISOString(), count: sorted.length, games: sorted }, null, 2));
  const by = (k) => sorted.filter((r) => r.steam_class === k).length;
  console.log(`저장: ${OUT} — 싱글 전용 ${by('single')} · 멀티/협동 ${by('multi')} · 정보 없음 ${by('none')} · IGDB 후보값 있음 ${sorted.filter((r) => r.igdb_max_candidate).length}개`);
  for (const r of sorted.slice(0, 10)) console.log(`  ${r.name} — 접속자 ${r.current_players ?? '?'} · ${r.steam_class} · IGDB 후보 ${r.igdb_max_candidate ?? '-'}`);
}

main().catch((e) => { console.error(`❌ ${e.message}`); process.exit(1); });
