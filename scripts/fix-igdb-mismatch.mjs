// scripts/fix-igdb-mismatch.mjs — 일회성: 예전 enrich-igdb가 이름 검색(limit 1)으로 엉뚱한 IGDB 게임을 잡아 덮어쓴 값을 바로잡는다
// - 대상: scripts/.cache/igdb-mismatch-163.csv의 게임만 (열: id, steam_appid, …). 이 파일은 레포에 올리지 않는다
// - 고치는 칸: enrich-igdb가 쓰던 장르·테마·평점(critic_score)·개발사·배급사·플랫폼만. 값은 스팀 앱 ID로 찾은 IGDB 게임에서 가져온다
// - 안전장치: 칸의 지금 값이 "예전 이름 검색이 썼을 값"과 같을 때만 바꾼다. 그 뒤 다른 값이 들어간 칸은 건드리지 않고 목록으로 보고한다
// - 기본은 미리보기(게임별 바뀌는 칸의 전/후 표). --apply일 때만 DB에 쓴다. AI 호출 없음
// 실행: node --env-file=.env.local scripts/fix-igdb-mismatch.mjs                  (미리보기)
//       node --env-file=.env.local scripts/fix-igdb-mismatch.mjs --only="THE FINALS,Portal 2"   (이름으로 골라 보기)
//       node --env-file=.env.local scripts/fix-igdb-mismatch.mjs --apply
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { getIgdbToken, igdbQuery, steamLookupBody, igdbValues, derivePlatform, sameName } from './lib/igdb.mjs';
import { planFix, FIX_FIELDS } from './lib/igdb-fix.mjs';

const APPLY = process.argv.includes('--apply');
const onlyArg = process.argv.find((a) => a.startsWith('--only='));
const ONLY = onlyArg ? onlyArg.slice(7).split(',').map((s) => s.trim()).filter(Boolean) : null;
const CSV = 'scripts/.cache/igdb-mismatch-163.csv';
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const FIELDS = `name, genres.name, themes.name, aggregated_rating, platforms.name, involved_companies.company.name, involved_companies.developer, involved_companies.publisher`;

// 따옴표로 감싼 CSV 읽기 (한 줄에 한 게임, 줄바꿈 없는 값만)
function readCsv(path) {
  const lines = fs.readFileSync(path, 'utf8').split('\n').filter(Boolean);
  const parse = (line) => [...line.matchAll(/"((?:[^"]|"")*)"|([^,]+)/g)].map((m) => (m[1] ?? m[2]).replace(/""/g, '"'));
  const head = parse(lines[0]);
  return lines.slice(1).map((l) => Object.fromEntries(parse(l).map((v, i) => [head[i], v])));
}

const show = (v) => (v == null || v === '' || (Array.isArray(v) && !v.length) ? '(빈칸)' : Array.isArray(v) ? v.join(', ') : String(v));
const withPlatform = (ig, game) => ({ ...igdbValues(ig), platform: derivePlatform(game.platform, ig.platforms, !!game.steam_appid) });

async function main() {
  if (!fs.existsSync(CSV)) return console.error(`${CSV}가 없어요`);
  let rows = readCsv(CSV);
  if (ONLY) rows = rows.filter((r) => ONLY.includes(r['DB이름']));
  console.log(`${APPLY ? '⚠️ 적용' : '미리보기'} — 대상 ${rows.length}개\n`);
  const token = await getIgdbToken();
  if (!token) return console.error('IGDB 토큰 발급 실패');

  const cols = ['id', 'name', 'steam_appid', ...FIX_FIELDS].join(', ');
  let changed = 0, same = 0, skipped = 0, failed = 0;
  const keptNotes = [];
  for (const r of rows) {
    const { data: game, error } = await supabase.from('games').select(cols).eq('id', r.id).single();
    if (error || !game) { console.log(`❌ ${r['DB이름']}: DB에서 못 찾음`); failed++; continue; }
    // 앱 ID로 찾은 IGDB 게임(옳은 값)과, 예전 코드가 잡았을 이름 검색 결과(덮어쓴 값)
    const app = (await igdbQuery('external_games', steamLookupBody(game.steam_appid, FIELDS.split(', ').map((f) => `game.${f}`).join(', ')), token))[0]?.game;
    await sleep(300);
    const hit = (await igdbQuery('games', `fields ${FIELDS}; search "${game.name.replace(/"/g, '')}"; limit 1;`, token))[0];
    await sleep(300);
    if (!app || !hit) { console.log(`⚪ ${game.name}: IGDB 결과가 달라져 건너뜀 (앱 ID ${app ? '있음' : '없음'}, 이름 검색 ${hit ? '있음' : '없음'})`); skipped++; continue; }
    if (hit.id === app.id) { console.log(`= ${game.name}: 이제는 같은 게임이라 건너뜀`); skipped++; continue; }
    // 예전에 이 이름이 정확히 같지 않은 게임을 잡았던 경우만 대상 (지금 규칙이면 어차피 쓰지 않는 값)
    const plan = planFix(game, withPlatform(hit, game), withPlatform(app, game));
    const names = Object.keys(plan.changes);
    console.log(`\n### ${game.name} — 예전 매칭 "${hit.name}" → 앱 ID 매칭 "${app.name}"${sameName(game.name, hit.name) ? ' (이름은 같음)' : ''}`);
    if (!names.length) { console.log('   바꿀 칸 없음'); same++; } else {
      console.log('| 칸 | 전 | 후 |\n|---|---|---|');
      for (const f of names) console.log(`| ${f} | ${show(plan.changes[f].before)} | ${show(plan.changes[f].after)} |`);
    }
    if (plan.kept.length) { console.log(`   건드리지 않음(DB 값이 이름 검색 값과 달라 나중에 바뀐 듯): ${plan.kept.join(', ')}`); keptNotes.push(`${game.name}: ${plan.kept.join(', ')}`); }
    if (!names.length) continue;
    changed++;
    if (APPLY) {
      const update = Object.fromEntries(names.map((f) => [f, plan.changes[f].after]));
      // 숫자·문자 칸은 읽은 값이 그대로일 때만 저장 (배열 칸은 위 계획이 방금 읽은 값 기준)
      let q = supabase.from('games').update(update).eq('id', game.id);
      for (const f of names) {
        const before = game[f];
        if (Array.isArray(before)) continue;
        q = before == null ? q.is(f, null) : q.eq(f, before);
      }
      const { error: e, data } = await q.select('id');
      if (e) { console.log(`   ❌ 저장 실패: ${e.message}`); failed++; } else if (!data?.length) console.log('   ⚠️ 읽은 뒤 값이 바뀌어 저장하지 않음');
      else console.log('   ✅ 저장');
    }
  }
  console.log(`\n${APPLY ? '적용' : '미리보기'} 결과 — 바뀌는 게임 ${changed}개 · 바꿀 칸 없음 ${same}개 · 건너뜀 ${skipped}개 · 실패 ${failed}개 · 일부 칸 유지 ${keptNotes.length}개`);
  if (!APPLY) console.log('DB는 바꾸지 않았어요. 적용하려면 --apply');
}

main().catch((e) => { console.error(`❌ ${e.message}`); process.exit(1); });
