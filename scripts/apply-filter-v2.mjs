// scripts/apply-filter-v2.mjs — 필터 개편 데이터를 DB에 반영 (AI 안 씀)
// 실행: node --env-file=.env.local scripts/apply-filter-v2.mjs           (미리보기 — DB는 안 바꿈)
//       node --env-file=.env.local scripts/apply-filter-v2.mjs --apply   (반영)
//       ... --apply --force                                              (이미 있는 값도 파일 값으로 덮어씀)
// - 먼저 supabase/migrations/20261012090000_filter_v2.sql 실행 필요
// - data/tags/tree.json → tags / data/tags/game-tags.json → game_tags
//   data/tags/entry-barrier.json → games.entry_barrier·entry_barrier_reason
//   data/meta/play-modes.json → games.solo_mode·party_max·session_max (game_id가 없는 줄은 steam_appid로 게임을 찾음)
// - 이미 값이 있으면 덮어쓰지 않음 (--force일 때만). 파일 값이 null이면 그 칸은 건드리지 않음
//   game_tags는 게임 단위: 그 게임에 태그가 하나라도 있으면 건너뜀, --force면 그 게임 태그를 파일 내용으로 바꿈
// - games·tags·game_tags 외의 표(가격 기록 등)는 건드리지 않음
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const APPLY = process.argv.includes('--apply');
const FORCE = process.argv.includes('--force');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const read = (path) => JSON.parse(fs.readFileSync(path, 'utf8'));

const report = { applied: [], skipped: [], problems: [] };
const print = (title, list, max = 40) => {
  if (!list.length) return;
  console.log(`\n${title} (${list.length})`);
  for (const l of list.slice(0, max)) console.log(`  - ${l}`);
  if (list.length > max) console.log(`  … 외 ${list.length - max}개`);
};

async function readAll(table, columns) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from(table).select(columns).range(from, from + 999);
    if (error) throw new Error(`${table} 조회 실패: ${error.message}\n→ supabase/migrations/20261012090000_filter_v2.sql 을 먼저 실행하세요`);
    rows.push(...data);
    if (data.length < 1000) break;
  }
  return rows;
}

// ── 1) tags ─────────────────────────────────────────
async function applyTags() {
  const { nodes } = read('data/tags/tree.json');
  const existing = new Map((await readAll('tags', 'id, key, ko, en, parent_id, depth, sort, hidden_empty')).map((t) => [t.id, t]));
  const sortOf = new Map();
  for (const n of nodes) n.children.forEach((c, i) => sortOf.set(c, i));
  const rows = nodes
    .map((n, i) => ({
      id: n.num, key: n.id, ko: n.ko, en: n.en || null, parent_id: n.parent_num ?? null, depth: n.depth,
      sort: n.parent ? sortOf.get(n.id) ?? i : i, hidden_empty: !!n.hidden_empty,
    }))
    .sort((a, b) => a.depth - b.depth); // 부모부터 (parent_id 참조)
  const toWrite = [];
  for (const r of rows) {
    const cur = existing.get(r.id);
    if (!cur) toWrite.push(r);
    else if (['key', 'ko', 'en', 'parent_id', 'depth', 'sort', 'hidden_empty'].some((k) => cur[k] !== r[k])) {
      if (FORCE) toWrite.push(r);
      else report.skipped.push(`태그 ${r.ko}(${r.id}): 이미 다른 값 있음 (--force로 덮어쓰기)`);
    }
  }
  if (APPLY) {
    for (const depth of [1, 2, 3, 4]) {
      const batch = toWrite.filter((r) => r.depth === depth);
      if (!batch.length) continue;
      const { error } = await supabase.from('tags').upsert(batch, { onConflict: 'id' });
      if (error) { report.problems.push(`태그 ${depth}단계 저장 실패: ${error.message}`); return false; }
    }
  }
  report.applied.push(`태그 ${toWrite.length}개 ${APPLY ? '저장' : '저장 예정'} (전체 ${rows.length}개, 이미 같은 값 ${rows.length - toWrite.length - report.skipped.filter((s) => s.startsWith('태그 ')).length}개)`);
  return true;
}

// ── 게임 찾기 ────────────────────────────────────────
async function loadGames() {
  const rows = await readAll('games', 'id, name, steam_appid, entry_barrier, entry_barrier_reason, solo_mode, party_max, session_max');
  return { byId: new Map(rows.map((g) => [g.id, g])), byAppid: new Map(rows.filter((g) => g.steam_appid).map((g) => [String(g.steam_appid), g])) };
}
const find = (games, row) => (row.game_id && games.byId.get(row.game_id)) || (row.steam_appid && games.byAppid.get(String(row.steam_appid))) || null;

// ── 2) game_tags ────────────────────────────────────
async function applyGameTags(games) {
  const file = read('data/tags/game-tags.json').games;
  const has = new Set((await readAll('game_tags', 'game_id')).map((r) => r.game_id));
  let games_n = 0, rows_n = 0;
  for (const g of file) {
    if (!g.tags.length) continue;
    const game = find(games, g);
    if (!game) { report.problems.push(`게임 태그: DB에 없는 게임 ${g.name} (${g.game_id})`); continue; }
    if (has.has(game.id) && !FORCE) { report.skipped.push(`게임 태그 ${g.name}: 이미 있음`); continue; }
    const rows = g.tags.map((t, i) => ({ game_id: game.id, tag_id: Number(t.node.replace(/^t:/, '')), votes: t.votes ?? null, rank: i + 1 }));
    if (APPLY) {
      if (has.has(game.id)) {
        const { error } = await supabase.from('game_tags').delete().eq('game_id', game.id);
        if (error) { report.problems.push(`게임 태그 ${g.name}: 기존 태그 정리 실패 (${error.message})`); continue; }
      }
      const { error } = await supabase.from('game_tags').insert(rows);
      if (error) { report.problems.push(`게임 태그 ${g.name}: 저장 실패 (${error.message})`); continue; }
    }
    games_n++; rows_n += rows.length;
  }
  report.applied.push(`게임 태그 ${games_n}개 게임 · ${rows_n}줄 ${APPLY ? '저장' : '저장 예정'}`);
}

// ── 3) games 칸 (진입장벽 · 혼자 플레이 · 팀/서버 인원) ──
async function applyGameFields(games) {
  const patches = new Map(); // game id → { game, patch }
  const want = (game, field, value, label) => {
    if (value == null) return;
    if (game[field] != null && game[field] !== value && !FORCE) { report.skipped.push(`${game.name} ${label}: 이미 ${game[field]} (파일 ${value})`); return; }
    if (game[field] === value) return;
    const p = patches.get(game.id) || { game, patch: {} };
    p.patch[field] = value;
    patches.set(game.id, p);
  };
  for (const r of read('data/tags/entry-barrier.json').games) {
    const game = find(games, r);
    if (!game) { report.problems.push(`진입장벽: DB에 없는 게임 ${r.name}`); continue; }
    if (r.level == null) continue;
    want(game, 'entry_barrier', r.level, '진입장벽');
    want(game, 'entry_barrier_reason', r.reason, '진입장벽 이유');
  }
  for (const r of read('data/meta/play-modes.json')) {
    const game = find(games, r);
    if (!game) { report.problems.push(`혼자 플레이: DB에 없는 게임 ${r.name} (${r.game_id || `앱 ${r.steam_appid}`})`); continue; }
    want(game, 'solo_mode', r.solo, '혼자 플레이');
    want(game, 'party_max', r.party_max, '팀 인원');
    want(game, 'session_max', r.session_max, '서버 인원');
  }
  let n = 0;
  for (const { game, patch } of patches.values()) {
    if (APPLY) {
      const { error } = await supabase.from('games').update(patch).eq('id', game.id);
      if (error) { report.problems.push(`${game.name}: 저장 실패 (${error.message})`); continue; }
    }
    n++;
  }
  report.applied.push(`게임 칸 ${n}개 게임 ${APPLY ? '반영' : '반영 예정'} (진입장벽·혼자 플레이·팀/서버 인원)`);
}

async function main() {
  console.log(APPLY ? `🟢 반영 모드${FORCE ? ' (--force: 있는 값도 덮어씀)' : ''}` : '👀 미리보기 (반영하려면 --apply)');
  const tagsOk = await applyTags();
  const games = await loadGames();
  if (tagsOk) await applyGameTags(games);
  await applyGameFields(games);
  print(APPLY ? '✅ 반영함' : '✅ 반영 예정', report.applied);
  print('⏭️  건너뜀 (이미 값 있음)', report.skipped);
  print('❌ 확인 필요', report.problems);
  if (!APPLY) console.log('\n※ 미리보기에서는 태그 표가 비어 있으면 게임 태그도 "저장 예정"으로만 셉니다.');
}

main().catch((e) => { console.error(e.message); process.exit(1); });
