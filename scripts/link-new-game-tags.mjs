// scripts/link-new-game-tags.mjs
// 새 게임을 태그 나무에 연결 — 스팀 태그(투표 수)를 받아 game_tags에 저장 (매주 갱신, 새 게임 수집 바로 다음 단계, AI 안 씀)
// 실행: node --env-file=.env.local scripts/link-new-game-tags.mjs             (미리보기 — DB는 안 바꿈)
//       node --env-file=.env.local scripts/link-new-game-tags.mjs --apply     (저장 — 매주 갱신이 쓰는 방식)
//       --ids <파일>  지정한 게임만 (lib/only-ids.mjs, 대상 조건은 그대로)
//       node --env-file=.env.local scripts/link-new-game-tags.mjs --compare 3 (태그가 이미 있는 게임 3개로 다시 만들어 DB 값과 비교, DB 안 씀)
//       node --env-file=.env.local scripts/link-new-game-tags.mjs --relink-tag t:1234 [--apply] [--limit 5]
//         (tree.json에 새로 넣은 태그를 이미 태그가 연결된 게임에도 붙임 — 아래 relinkTag 설명. 전체 약 660개 기준 약 16분)
// - 대상: 스팀 앱 번호가 있고 game_tags가 하나도 없는 게임 (숨긴 게임 제외, 한 번 처리한 게임(tags_linked_at)도 제외)
// - 변환 규칙은 scripts/lib/steam-tags.mjs (data/tags/game-tags.json 만들 때와 같음), 태그 번호는 tree.json의 num = tags.id
// - tree.json에 없는 새 스팀 태그는 저장하지 않고 tag_unclassified 표에 이름·게임 수를 기록 → 디스코드 일일 요약에 한 줄
// - 받은 원본 태그는 scripts/.cache/new-game-steam-tags.json에 저장 (다음 단계 judge-new-games.mjs가 씀)
// - 먼저 supabase/migrations/20261013090000_new_game_tagging.sql 실행 필요 (없어도 태그 저장은 되지만 처리 표시·새 태그 기록은 건너뜀)
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { fetchSteamTags, steamTagKoNames, loadTagRules, toGameTags, SteamTagsMissing } from './lib/steam-tags.mjs';
import { onlyIds } from './lib/only-ids.mjs';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const APPLY = process.argv.includes('--apply');
const COMPARE = process.argv.includes('--compare') ? Number(process.argv[process.argv.indexOf('--compare') + 1]) || 3 : 0;
const argOf = (name) => (process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : null);
const RELINK = argOf('--relink-tag');
const LIMIT = Number(argOf('--limit')) || 0;
const CACHE = 'scripts/.cache/new-game-steam-tags.json';
const TIME_BUDGET_MS = 40 * 60 * 1000; // run-steps 단계 시간 제한(45분) 전에 스스로 멈춤
const startedAt = Date.now();

async function readAll(table, columns, apply = (q) => q) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await apply(supabase.from(table).select(columns)).range(from, from + 999);
    if (error) throw new Error(`${table} 조회 실패: ${error.message}`);
    rows.push(...data);
    if (data.length < 1000) break;
  }
  return rows;
}

// 마이그레이션(tags_linked_at·tag_unclassified)이 됐는지
async function hasMigration() {
  const a = await supabase.from('games').select('tags_linked_at').limit(1);
  const b = await supabase.from('tag_unclassified').select('steam_tag_id').limit(1);
  return !a.error && !b.error;
}

async function saveUnclassified(unknown) {
  if (!unknown.size) return;
  const ko = await steamTagKoNames().catch(() => new Map());
  const { data: prev, error } = await supabase.from('tag_unclassified').select('*').in('steam_tag_id', [...unknown.keys()]);
  if (error) return console.log(`⚠️ 새 태그 기록 실패 (${error.message})`);
  const prevById = new Map(prev.map((r) => [r.steam_tag_id, r]));
  const now = new Date().toISOString();
  const rows = [...unknown].map(([id, u]) => {
    const p = prevById.get(id);
    return {
      steam_tag_id: id,
      en: p?.en ?? u.en,
      ko: p?.ko ?? ko.get(id) ?? null,
      game_count: (p?.game_count ?? 0) + u.games.length,
      game_names: [...new Set([...(p?.game_names ?? []), ...u.games])].slice(0, 10),
      last_seen_at: now,
    };
  });
  const { error: e2 } = await supabase.from('tag_unclassified').upsert(rows, { onConflict: 'steam_tag_id' });
  if (e2) console.log(`⚠️ 새 태그 기록 실패 (${e2.message})`);
}

// --relink-tag: tree.json에 새로 넣은 태그를, 이미 태그가 연결된 게임에도 붙임
// - 대상: 태그가 이미 있고 그 태그는 아직 없는 게임 → 스팀 태그를 다시 받아, 그 태그가 있는 게임만 처리
// - 같은 규칙(제외·합치기·투표 기준·최대 15개)으로 다시 계산했을 때 그 태그가 들어가는 게임에만 추가
//   기존 태그는 지우지 않음: 그 자리에 끼워 넣고 뒤 순서만 한 칸씩 밀기 (이미 15개였던 게임은 16개가 될 수 있음)
async function relinkTag(rules, dbTagIds, linked, games) {
  const node = rules.tree.get(Number(String(RELINK).replace(/^t:/, '')));
  if (!node) throw new Error(`tree.json에 없는 태그 키: ${RELINK} (예: t:1234 — 묶음 칸 g:는 스팀 태그가 아니라 안 됨)`);
  if (!dbTagIds.has(node.num)) throw new Error(`${node.ko}(${node.id})가 DB tags 표에 없음 — 먼저 apply-filter-v2.mjs --apply`);
  // 합친 태그(merged.json)로 이 칸에 모이는 스팀 태그도 같이 봄
  const steamIds = new Set([node.num, ...[...rules.merged].filter(([, into]) => into === node.num).map(([from]) => from)]);
  let targets = games.filter((g) => linked.has(g.id) && !linked.get(g.id).some((r) => r.tag_id === node.num));
  if (LIMIT) targets = targets.slice(0, LIMIT);
  console.log(`${node.ko}(${node.id}) — 다시 받을 게임 ${targets.length}개 (약 ${Math.ceil(targets.length * 1.5 / 60)}분)\n`);

  let added = 0, hasTag = 0;
  const failed = [];
  for (const [i, g] of targets.entries()) {
    if (Date.now() - startedAt > TIME_BUDGET_MS) { console.log(`⏱️ 시간 예산 초과 — 남은 ${targets.length - i}개는 다시 실행하면 이어서 (이미 붙은 게임은 대상에서 빠짐)`); break; }
    let steamTags;
    try { steamTags = await fetchSteamTags(g.steam_appid); } catch (e) { failed.push(`${g.name}: ${e.message}`); continue; }
    if (!steamTags.some((t) => steamIds.has(t.id))) continue; // 스팀 태그에 없는 게임은 건너뜀
    hasTag++;
    const fresh = toGameTags(steamTags, rules).tags.filter((t) => dbTagIds.has(t.tag_id));
    const pos = fresh.findIndex((t) => t.tag_id === node.num);
    if (pos < 0) { console.log(`[${i + 1}/${targets.length}] ${g.name}: 스팀 태그엔 있지만 기준(투표 수·15개) 밖 — 추가 안 함`); continue; }
    const cur = linked.get(g.id).sort((a, b) => a.rank - b.rank);
    const at = Math.min(pos, cur.length);
    console.log(`[${i + 1}/${targets.length}] ${g.name}: ${node.ko}(${fresh[pos].votes}) ${at + 1}위로 추가${cur.length >= 15 ? ' (16개가 됨)' : ''}`);
    if (APPLY) {
      // 뒤 순서부터 한 칸씩 밀고 새 태그 넣기
      let shiftError = null;
      for (const r of cur.slice(at).reverse()) {
        ({ error: shiftError } = await supabase.from('game_tags').update({ rank: r.rank + 1 }).eq('game_id', g.id).eq('tag_id', r.tag_id));
        if (shiftError) break;
      }
      if (shiftError) { failed.push(`${g.name}: 순서 밀기 실패 (${shiftError.message}) — 추가 안 함`); continue; }
      const { error } = await supabase.from('game_tags').insert({ game_id: g.id, tag_id: node.num, votes: fresh[pos].votes, rank: at + 1 });
      if (error) { failed.push(`${g.name}: 저장 실패 (${error.message})`); continue; }
    }
    added++;
  }
  console.log(`\n✅ 스팀 태그에 「${node.ko}」 태그가 있는 게임 ${hasTag}개 중 ${added}개 ${APPLY ? '추가' : '추가 예정'}`);
  if (failed.length) {
    console.log(`❌ 실패 ${failed.length}개`);
    for (const f of failed) console.log(`  - ${f}`);
  }
}

async function main() {
  console.log(COMPARE ? `🔍 비교 모드 (기존 게임 ${COMPARE}개, DB 안 씀)` : APPLY ? '🟢 저장 모드' : '👀 미리보기 (저장하려면 --apply)');
  if (RELINK) console.log(`🔁 태그 다시 연결: ${RELINK}${LIMIT ? ` (게임 ${LIMIT}개만)` : ''}`);
  const rules = loadTagRules();
  const dbTagIds = new Set((await readAll('tags', 'id')).map((t) => t.id));
  const missingInDb = [...rules.tree.keys()].filter((id) => !dbTagIds.has(id));
  if (missingInDb.length) console.log(`⚠️ tree.json에는 있지만 DB tags 표에 없는 태그 ${missingInDb.length}개 — 연결하지 않음 (apply-filter-v2.mjs --apply 필요)`);

  const migrated = await hasMigration();
  if (!migrated) console.log('⚠️ 마이그레이션 20261013090000_new_game_tagging.sql 전 — 처리 표시·새 태그 기록은 건너뜀');

  const linked = new Map();
  for (const r of await readAll('game_tags', 'game_id, tag_id, votes, rank')) {
    if (!linked.has(r.game_id)) linked.set(r.game_id, []);
    linked.get(r.game_id).push(r);
  }
  const games = await readAll('games', `id, name, steam_appid, created_at${migrated ? ', tags_linked_at' : ''}`, (q) =>
    onlyIds(q.not('steam_appid', 'is', null).eq('hidden', false).order('created_at', { ascending: false })));
  if (RELINK) return relinkTag(rules, dbTagIds, linked, games);
  const targets = COMPARE
    ? games.filter((g) => linked.has(g.id)).slice(0, COMPARE)
    : games.filter((g) => !linked.has(g.id) && !g.tags_linked_at);
  console.log(`대상 ${targets.length}개${COMPARE ? '' : ' (스팀 앱 번호 있음 · game_tags 없음 · 숨김 아님 · 처리 기록 없음)'}\n`);

  const cache = { date: new Date().toISOString().slice(0, 10), games: {} };
  const unknown = new Map(); // steam tag id → { en, games: [이름] }
  const failed = [];
  let saved = 0, rows = 0, same = 0;
  for (const [i, g] of targets.entries()) {
    if (Date.now() - startedAt > TIME_BUDGET_MS) { console.log(`⏱️ 시간 예산 초과 — 남은 ${targets.length - i}개는 다음 실행에`); break; }
    const head = `[${i + 1}/${targets.length}] ${g.name}`;
    let steamTags;
    try {
      steamTags = await fetchSteamTags(g.steam_appid);
    } catch (e) {
      failed.push(`${g.name} (${g.steam_appid}): ${e.message}`);
      console.log(`${head}: ❌ ${e.message}`);
      // 상점 페이지·태그가 없는 게임은 처리 완료로 표시 (다시 받아도 같음), 연결 실패·막힘은 다음 주에 다시
      if (APPLY && migrated && e instanceof SteamTagsMissing) await supabase.from('games').update({ tags_linked_at: new Date().toISOString() }).eq('id', g.id);
      continue;
    }
    cache.games[g.id] = steamTags;
    const { tags, unknown: newTags } = toGameTags(steamTags, rules);
    const usable = tags.filter((t) => dbTagIds.has(t.tag_id));
    const label = (t) => `${rules.tree.get(t.tag_id).ko}(${t.votes})`;

    if (COMPARE) {
      const cur = linked.get(g.id).sort((a, b) => a.rank - b.rank);
      const key = (list, votes) => list.map((t) => `${t.tag_id}:${t.rank}${votes ? `:${t.votes}` : ''}`).join(',');
      const ok = key(cur) === key(usable); // 태그·순서가 같으면 같음 (스팀 투표 수는 그 사이 조금씩 바뀜)
      if (ok) same++;
      const status = !ok ? '❌ DB와 다름' : key(cur, true) === key(usable, true) ? '✅ DB와 같음' : '✅ 태그·순서 같음 (투표 수만 그 사이 바뀜)';
      console.log(`${head}: ${status} — ${usable.length}개`);
      console.log(`   새로 만든 값: ${usable.map(label).join(', ')}`);
      if (key(cur, true) !== key(usable, true)) console.log(`   지금 DB 값:${cur.map((t) => `${rules.tree.get(t.tag_id)?.ko ?? t.tag_id}(${t.votes})`).join(', ')}`);
      if (newTags.length) console.log(`   분류 안 된 태그: ${newTags.map((t) => `${t.en}(${t.votes})`).join(', ')}`);
      continue;
    }

    for (const t of newTags) {
      if (!unknown.has(t.id)) unknown.set(t.id, { en: t.en, games: [] });
      unknown.get(t.id).games.push(g.name);
    }
    console.log(`${head}: ${usable.length}개 — ${usable.map(label).join(', ') || '(연결할 태그 없음)'}${newTags.length ? ` · 분류 안 된 태그 ${newTags.map((t) => t.en).join(', ')}` : ''}`);
    if (APPLY) {
      if (usable.length) {
        const { error } = await supabase.from('game_tags').insert(usable.map((t) => ({ game_id: g.id, ...t })));
        if (error) { failed.push(`${g.name}: 저장 실패 (${error.message})`); continue; }
      }
      if (migrated) await supabase.from('games').update({ tags_linked_at: new Date().toISOString() }).eq('id', g.id);
    }
    saved++; rows += usable.length;
  }

  if (!COMPARE) {
    fs.mkdirSync('scripts/.cache', { recursive: true });
    fs.writeFileSync(CACHE, JSON.stringify(cache));
  }
  if (APPLY && migrated) await saveUnclassified(unknown);

  console.log('');
  if (COMPARE) console.log(`✅ 비교: ${targets.length}개 중 ${same}개가 DB 값과 같음`);
  else console.log(`✅ ${saved}개 게임 · ${rows}줄 ${APPLY ? '저장' : '저장 예정'}`);
  if (unknown.size) console.log(`🆕 분류 안 된 새 태그 ${unknown.size}개: ${[...unknown].map(([id, u]) => `${u.en}(${id}, ${u.games.length}개 게임)`).join(', ')}`);
  if (failed.length) {
    console.log(`❌ 실패 ${failed.length}개`);
    for (const f of failed) console.log(`  - ${f}`);
  }
}

main().catch((e) => { console.error(e.message); process.exit(1); });
