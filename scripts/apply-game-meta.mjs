// scripts/apply-game-meta.mjs — data/meta의 GOTY·시리즈·공식 디스코드를 games에 반영 (AI 안 씀)
// 실행: node --env-file=.env.local scripts/apply-game-meta.mjs                 (미리보기 — DB는 안 바꿈)
//       node --env-file=.env.local scripts/apply-game-meta.mjs --apply         (반영)
//       ... --ref=origin/content/game-meta-v2   (파일을 지금 폴더 대신 git 브랜치에서 읽기)
// - 먼저 supabase/migrations/20261007090000_game_meta.sql 실행 필요
// - 이미 값이 있는 게임은 덮어쓰지 않음 (같으면 조용히 건너뛰고, 다르면 목록으로 보고)
// - 디스코드는 반영 전에 Discord 공개 API로 초대가 살아 있는지, 공식 인증(VERIFIED) 서버인지, 서버 이름이 게임 이름과 맞는지 확인
//   만료·임시 초대·이름 불일치는 반영하지 않고 목록으로 보고 (직접 확인 후 손으로 넣기)
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

const APPLY = process.argv.includes('--apply');
const REF = process.argv.find((a) => a.startsWith('--ref='))?.slice(6);
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function readMeta(file) {
  const path = `data/meta/${file}`;
  try {
    const text = REF ? execFileSync('git', ['show', `${REF}:${path}`], { encoding: 'utf8' }) : fs.readFileSync(path, 'utf8');
    return JSON.parse(text);
  } catch {
    console.log(`⚠️  ${REF ? `${REF}:` : ''}${path} 없음 — 건너뜀`);
    return [];
  }
}

async function loadGames() {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('games')
      .select('id, name, search_name_ko, goty_awards, series_id, series_order, discord_url')
      .order('id')
      .range(from, from + 999);
    if (error) {
      console.error(`게임 불러오기 실패: ${error.message}\n→ supabase/migrations/20261007090000_game_meta.sql 을 먼저 실행하세요`);
      process.exit(1);
    }
    rows.push(...data);
    if (data.length < 1000) break;
  }
  return new Map(rows.map((g) => [g.id, g]));
}

const report = { applied: [], skipped: [], problems: [] };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

async function update(id, patch, label) {
  if (APPLY) {
    const { error } = await supabase.from('games').update(patch).eq('id', id);
    if (error) return report.problems.push(`${label}: 저장 실패 (${error.message})`);
  }
  report.applied.push(label);
}

// ── GOTY ──────────────────────────────────────────
async function applyGoty(games) {
  const byGame = new Map();
  for (const r of readMeta('goty.json')) {
    if (!['winner', 'nominee'].includes(r.result) || !Number.isInteger(r.year)) {
      report.problems.push(`GOTY 형식 오류: ${JSON.stringify(r)}`);
      continue;
    }
    byGame.set(r.game_id, [...(byGame.get(r.game_id) || []), { year: r.year, result: r.result }]);
  }
  for (const [id, awards] of byGame) {
    const g = games.get(id);
    if (!g) { report.problems.push(`GOTY: 없는 게임 ${id}`); continue; }
    awards.sort((a, b) => a.year - b.year);
    if (g.goty_awards == null) await update(id, { goty_awards: awards }, `GOTY ${g.name}: ${awards.map((a) => `${a.year} ${a.result}`).join(', ')}`);
    else if (!same(g.goty_awards, awards)) report.skipped.push(`GOTY ${g.name}: 이미 다른 값 있음 ${JSON.stringify(g.goty_awards)}`);
  }
}

// ── 시리즈 ─────────────────────────────────────────
async function seriesId(name) {
  const { data } = await supabase.from('series').select('id').eq('name_ko', name).maybeSingle();
  if (data) return data.id;
  if (!APPLY) return null; // 미리보기에서는 새 시리즈를 만들지 않음
  const { data: created, error } = await supabase.from('series').insert({ name_ko: name }).select('id').single();
  if (error) throw new Error(`시리즈 ${name} 만들기 실패: ${error.message}`);
  return created.id;
}

async function applySeries(games, list) {
  const taken = new Map(); // 한 게임이 여러 시리즈에 들어 있으면 처음 것만
  for (const s of list) {
    const ids = (s.game_ids || []).filter((id) => {
      if (!games.has(id)) { report.problems.push(`시리즈 ${s.series_name_ko}: 없는 게임 ${id}`); return false; }
      if (taken.has(id)) { report.problems.push(`시리즈 ${s.series_name_ko}: ${games.get(id).name}은 이미 ${taken.get(id)}에 있음 — 건너뜀`); return false; }
      taken.set(id, s.series_name_ko);
      return true;
    });
    if (ids.length < 2) { report.skipped.push(`시리즈 ${s.series_name_ko}: 게임 2개 미만`); continue; }
    const sid = await seriesId(s.series_name_ko);
    for (const [i, id] of ids.entries()) {
      const g = games.get(id);
      const label = `시리즈 ${s.series_name_ko} #${i + 1} ${g.name}`;
      if (g.series_id == null) await update(id, { series_id: sid, series_order: i + 1 }, label);
      else if (sid == null || g.series_id !== sid || g.series_order !== i + 1) report.skipped.push(`${label}: 이미 다른 시리즈/순서 (series_id ${g.series_id}, ${g.series_order})`);
    }
  }
}

// ── 디스코드 ───────────────────────────────────────
const norm = (s) => String(s || '').toLowerCase()
  .replace(/[™®©]/g, '')
  .replace(/&/g, 'and')
  .replace(/\b(official|community|server|discord|game|the)\b/g, '')
  .replace(/[\s\p{P}\p{S}]/gu, '');

function nameMatches(guildName, aliases) {
  const gn = norm(guildName);
  if (gn.length < 3) return false;
  return aliases.map(norm).filter((a) => a.length >= 3).some((a) => gn.includes(a) || a.includes(gn));
}

async function fetchInvite(code) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(`https://discord.com/api/v10/invites/${encodeURIComponent(code)}`);
    if (res.status === 429) {
      const body = await res.json().catch(() => ({}));
      await sleep(Math.ceil((body.retry_after || 5) * 1000));
      continue;
    }
    if (res.status === 404) return { dead: true };
    if (!res.ok) return { error: `HTTP ${res.status}` };
    return res.json();
  }
  return { error: '요청 제한(429) 반복' };
}

async function applyDiscord(games, seriesList) {
  const seriesOf = new Map(seriesList.flatMap((s) => (s.game_ids || []).map((id) => [id, s.series_name_ko])));
  for (const c of readMeta('discord-candidates.json')) {
    const g = games.get(c.game_id);
    if (!g) { report.problems.push(`디스코드: 없는 게임 ${c.game_id}`); continue; }
    const code = String(c.invite_url || '').match(/^https:\/\/(?:discord\.gg|discord\.com\/invite)\/([A-Za-z0-9-]+)\/?$/)?.[1];
    const label = `디스코드 ${g.name} (${c.invite_url})`;
    if (!code) { report.problems.push(`${label}: 초대 주소 형식이 아님`); continue; }
    const url = `https://discord.gg/${code}`;
    if (g.discord_url) {
      if (g.discord_url !== url) report.skipped.push(`${label}: 이미 다른 주소 ${g.discord_url}`);
      continue;
    }
    const inv = await fetchInvite(code);
    await sleep(1200);
    if (inv.dead) { report.problems.push(`${label}: 만료됐거나 없는 초대`); continue; }
    if (inv.error) { report.problems.push(`${label}: 확인 실패 (${inv.error})`); continue; }
    const guild = inv.guild?.name;
    if (!guild) { report.problems.push(`${label}: 서버 초대가 아님`); continue; }
    if (inv.expires_at) { report.problems.push(`${label}: 임시 초대 (${inv.expires_at} 만료) — 서버 "${guild}"`); continue; }
    // 공식 서버만: Discord 인증(VERIFIED) 배지 필수. PARTNERED는 팬 서버(예: 레딧 서버)도 받으므로 근거로 안 씀
    if (!inv.guild.features?.includes('VERIFIED')) { report.problems.push(`${label}: Discord 공식 인증 없는 서버 "${guild}"`); continue; }
    const aliases = [g.name, ...String(g.search_name_ko || '').split(','), seriesOf.get(g.id)].filter(Boolean);
    if (!nameMatches(guild, aliases)) {
      report.problems.push(`${label}: 서버 이름 "${guild}"이(가) 게임 이름과 다름${c.note ? ` (메모: ${c.note})` : ''}`);
      continue;
    }
    await update(g.id, { discord_url: url }, `${label} → 서버 "${guild}"`);
  }
}

async function main() {
  console.log(APPLY ? '🟢 반영 모드' : '👀 미리보기 (반영하려면 --apply)');
  const games = await loadGames();
  const seriesList = readMeta('series.json');
  await applyGoty(games);
  await applySeries(games, seriesList);
  await applyDiscord(games, seriesList);

  const print = (title, list) => { if (list.length) console.log(`\n${title} (${list.length})\n` + list.map((l) => `  - ${l}`).join('\n')); };
  print(APPLY ? '✅ 반영함' : '✅ 반영 예정', report.applied);
  print('⏭️  건너뜀 (이미 값 있음 등)', report.skipped);
  print('❌ 반영 안 함 — 직접 확인 필요', report.problems);
  if (!APPLY && report.applied.length) console.log('\n※ 미리보기에서는 새 시리즈를 만들지 않으므로, 새 시리즈 게임은 반영 때 처음 묶입니다.');
}

main().catch((e) => { console.error(e); process.exit(1); });
