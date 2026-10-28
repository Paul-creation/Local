// scripts/fill-players-from-store.mjs
// 노출 게임 중 최대 인원이 빈 게임을 스팀 상점 소개문(short_description·about_the_game, 영어)에서 채움 (AI 안 씀)
// - 파서는 scripts/lib/players-from-store.mjs: 숫자가 하나로 확실할 때(또는 협동·대전 숫자가 라벨로 나뉠 때)만 채우고,
//   숫자가 여럿이거나 17명 이상(서버·대규모)이면 안 채우고 대기 목록(scripts/.cache/players-store-pending.json)에 근거 문장과 함께 저장
// - 빈 칸만 채운다: max_players가 아직 null일 때만 쓰고, min_players는 비어 있을 때만 채운다. 한 번 본 게임은 players_store_checked_at에 기록해 다시 보지 않는다
// - 채운 게임은 players_auto_at에 시각을 남김 (일일 요약의 "이번 주 자동 채움")
// - 미리보기가 기본(DB 쓰기 없음). --apply일 때만 DB에 씀. --all은 이미 본 게임도 다시 봄(미리보기용)
// - --ids <파일>: 지정한 게임만 (lib/only-ids.mjs, 대상 조건은 그대로)
// - 처리 순서는 인기순 (ITAD heat_rank 오름차순 → 리뷰 수 내림차순)
// - 소개문은 scripts/.cache/store-text.json에 캐시 (미리보기 뒤 --apply 때 다시 받지 않음)
// 실행: node --env-file=.env.local scripts/fill-players-from-store.mjs [--apply] [--all] [--max-steam=300] [--hold=게임id,게임id] [--ids 파일.json]
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { steamGet, appdetailsUrl, SteamLimitError } from './lib/steam.mjs';
import { extractPlayers } from './lib/players-from-store.mjs';
import { refreshCategory } from './lib/category.mjs';
import { onlyIds } from './lib/only-ids.mjs';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const APPLY = process.argv.includes('--apply');
const ALL = process.argv.includes('--all');
const HOLD = new Set((process.argv.find((a) => a.startsWith('--hold='))?.slice(7) || '').split(',').filter(Boolean)); // 규칙으로 못 거른 의심 게임 id: 채우지 않고 대기로
const maxArg = process.argv.find((a) => a.startsWith('--max-steam='));
const MAX_STEAM = maxArg ? Number(maxArg.slice(12)) : 300;
const CACHE = 'scripts/.cache/store-text.json';
const OUT = 'scripts/.cache/players-store-pending.json';

// 인기 순서: ITAD 순위(heat_rank, 작을수록 위) → 순위 없으면 리뷰 수 많은 순 → 이름 순. 소개문 요청 상한(--max-steam)이 있어 인기 게임부터 처리됨
function byPopularity(rows) {
  return rows.sort((a, b) => (a.heat_rank ?? Infinity) - (b.heat_rank ?? Infinity) || (b.review_total ?? 0) - (a.review_total ?? 0) || a.name.localeCompare(b.name));
}

async function loadTargets() {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    let q = onlyIds(supabase.from('games').select('id, name, steam_appid, min_players, heat_rank, review_total')).eq('hidden', false).is('max_players', null).not('steam_appid', 'is', null);
    if (!ALL) q = q.is('players_store_checked_at', null);
    const { data, error } = await q.order('id').range(from, from + 999);
    if (error) throw new Error(`게임 목록을 못 불러옴: ${error.message}${/players_store_checked_at/.test(error.message) ? ' (마이그레이션 20261028090000_players_from_store.sql을 먼저 실행하거나 --all로 미리보기만)' : ''}`);
    rows.push(...data);
    if (data.length < 1000) return byPopularity(rows);
  }
}

async function storeTexts(games) {
  const cache = fs.existsSync(CACHE) ? JSON.parse(fs.readFileSync(CACHE, 'utf8')) : {};
  let fetched = 0;
  for (const g of games) {
    if (cache[g.steam_appid] || fetched >= MAX_STEAM) continue;
    try {
      const d = (await steamGet(appdetailsUrl(g.steam_appid, 'english')))?.[g.steam_appid];
      cache[g.steam_appid] = d?.success ? { short: d.data.short_description || '', about: d.data.about_the_game || '' } : { short: '', about: '', none: true };
      fetched++;
    } catch (e) {
      console.log(`❌ ${g.name}: ${e.message}`);
      if (e instanceof SteamLimitError) break;
      continue;
    }
    fs.mkdirSync('scripts/.cache', { recursive: true });
    fs.writeFileSync(CACHE, JSON.stringify(cache));
  }
  console.log(`소개문: 캐시 ${games.length - fetched}개 이내 · 새로 받음 ${fetched}개`);
  return cache;
}

async function save(g, r) {
  const now = new Date().toISOString();
  if (r.status !== 'fill') {
    const { error } = await supabase.from('games').update({ players_store_checked_at: now }).eq('id', g.id);
    return error ? `확인 기록 실패: ${error.message}` : null;
  }
  const update = { max_players: r.max, players_store_checked_at: now, players_auto_at: now };
  if (r.min != null && g.min_players == null) update.min_players = r.min;
  const { data, error } = await supabase.from('games').update(update).eq('id', g.id).is('max_players', null).select('id');
  if (error || !data?.length) return error?.message || '그사이 값이 바뀌어 건너뜀';
  await refreshCategory(supabase, g.id);
  return null;
}

async function main() {
  const games = await loadTargets();
  console.log(`${APPLY ? '반영' : '미리보기'} — 최대 인원이 빈 게임 ${games.length}개${ALL ? ' (이미 본 게임 포함)' : ''}`);
  const cache = await storeTexts(games);

  const rows = [];
  const stat = { fill: 0, pending: 0, none: 0, nodata: 0, failed: 0 };
  for (const g of games) {
    const t = cache[g.steam_appid];
    if (!t) { stat.nodata++; continue; } // 아직 못 받은 게임은 다음에
    const r = HOLD.has(g.id) ? { status: 'pending', reason: 'manual', values: [], evidence: ['수동 대기'] } : extractPlayers([t.short, t.about]);
    stat[r.status]++;
    const failed = APPLY ? await save(g, r) : null;
    if (failed) { stat.failed++; console.log(`❌ ${g.name}: ${failed}`); continue; }
    rows.push({ id: g.id, name: g.name, steam_appid: g.steam_appid, ...r });
  }
  fs.mkdirSync('scripts/.cache', { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify({ generated_at: new Date().toISOString(), applied: APPLY, rows }, null, 2));
  for (const r of rows.filter((x) => x.status === 'fill')) console.log(`${APPLY ? '✅' : '·'} ${r.name}: ${r.min ?? ''}${r.min != null ? '~' : ''}${r.max} (${r.reason}) — ${r.evidence[0]}`);
  for (const r of rows.filter((x) => x.status === 'pending')) console.log(`⏸ ${r.name}: 대기 (${r.reason} ${r.values.join('/')}) — ${r.evidence[0]}`);
  console.log(`\n채움${APPLY ? '' : ' 예정'} ${stat.fill} · 대기 ${stat.pending} · 문장 없음 ${stat.none} · 소개문 못 받음 ${stat.nodata}${stat.failed ? ` · 실패 ${stat.failed}` : ''} → ${OUT}`);
}

main().catch((e) => { console.error(`❌ ${e.message}`); process.exit(1); });
