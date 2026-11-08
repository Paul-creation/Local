// scripts/fill-new-game.mjs
// 새로 추가된 게임을 매주 갱신(weekly)을 기다리지 않고 바로 채움 — weekly 단계 중 새 게임에 필요한 것을 그 게임 id만 대상으로 순서대로 실행
// 실행: node --env-file=.env.local scripts/fill-new-game.mjs                  (최근 14일 안에 들어온 숨기지 않은 게임)
//       node --env-file=.env.local scripts/fill-new-game.mjs --days 7          (일수 지정)
//       node --env-file=.env.local scripts/fill-new-game.mjs --ids <id>,<id>   (게임 id 목록, 또는 [{ "id": ... }] JSON 파일 경로)
//       --activities-max N  가능한 활동(Sonnet 배치)을 한 번에 최대 N개까지 (기본 10, 넘는 건 다음 weekly가 --new-days 14로 채움)
//       --skip a,b  건너뛸 단계 (환경변수 FILL_NEW_SKIP도 같음)
//       --dry-run  대상 게임과 실행할 단계만 출력 (DB·AI 안 씀)
// - 단계 목록은 lib/new-game-steps.mjs. 각 단계는 weekly와 같은 스크립트·같은 방식(빈 칸만 채움, 처리한 건 다시 안 함)이라 여러 번 돌려도 안전
// - 한국어 소개(write-fun-descriptions)는 fun_description이 빈 게임만 넘김 (이미 쓴 소개는 안 덮음)
// - 한 단계가 실패해도 나머지는 계속, 마지막에 요약. bulk-import(--curator·--fill-new)와 import-curator-queue가 끝에서 부름
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import { NEW_GAME_STEPS, stepArgs, parseIdsArg } from './lib/new-game-steps.mjs';

const arg = (f) => (process.argv.includes(f) ? process.argv[process.argv.indexOf(f) + 1] : null);
const DRY = process.argv.includes('--dry-run');
const SKIP = (arg('--skip') || process.env.FILL_NEW_SKIP || '').split(',').filter(Boolean);
const ACT_MAX = Number(arg('--activities-max')) || 10;
const DAYS = Number(arg('--days')) || 14;
const CACHE = 'scripts/.cache';
const STEP_TIMEOUT_MIN = { 'fill-activities-v2': 90 };
const envArgs = fs.existsSync('.env.local') ? ['--env-file=.env.local'] : [];
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function run(name, args) {
  return new Promise((resolve) => {
    const started = Date.now();
    console.log(`\n──── ▶ ${name} ${args.join(' ')}`);
    const child = spawn('node', [...envArgs, `scripts/${name}.mjs`, ...args], { stdio: 'inherit' });
    const timer = setTimeout(() => child.kill('SIGTERM'), (STEP_TIMEOUT_MIN[name] ?? 30) * 60 * 1000);
    child.on('exit', (code, signal) => { clearTimeout(timer); resolve({ name, ok: code === 0 && !signal, sec: Math.round((Date.now() - started) / 1000) }); });
  });
}

async function main() {
  let ids = parseIdsArg(arg('--ids'), (f) => fs.readFileSync(f, 'utf8'));
  let games;
  if (ids) {
    ({ data: games } = await supabase.from('games').select('id, name, fun_description').in('id', ids));
  } else {
    const since = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase.from('games').select('id, name, fun_description').eq('hidden', false).gte('created_at', since).order('created_at');
    if (error) throw new Error(`게임 조회 실패: ${error.message}`);
    games = data;
  }
  games ||= [];
  console.log(`${DRY ? '미리보기' : '실행'} — 새 게임 ${games.length}개${ids ? ' (--ids)' : ` (최근 ${DAYS}일)`}: ${games.map((g) => g.name).join(', ') || '없음'}`);
  if (!games.length) return;

  fs.mkdirSync(CACHE, { recursive: true });
  const idsFile = `${CACHE}/fill-new-game-ids.json`;
  const funIdsFile = `${CACHE}/fill-new-game-fun-ids.json`;
  fs.writeFileSync(idsFile, JSON.stringify(games.map((g) => ({ id: g.id }))));
  const needFun = games.filter((g) => !g.fun_description);
  fs.writeFileSync(funIdsFile, JSON.stringify(needFun.map((g) => ({ id: g.id }))));
  console.log(`한국어 소개가 빈 게임 ${needFun.length}개`);

  const results = [];
  for (const step of NEW_GAME_STEPS) {
    const [name, args] = stepArgs(step, { idsFile, funIdsFile, days: DAYS, actMax: ACT_MAX });
    if (SKIP.includes(name)) { console.log(`\n──── ${name} — 건너뜀 (--skip)`); continue; }
    if (DRY) { console.log(`  · ${name} ${args.join(' ')}`); continue; }
    if (name === 'write-fun-descriptions' && !needFun.length) { console.log('\n──── write-fun-descriptions — 빈 게임 없음, 건너뜀'); continue; }
    const r = await run(name, args);
    if (!r.ok) console.log(`${name} 실패 — 건너뛰고 계속 (다음 weekly가 빈 칸을 채움)`);
    results.push(r);
  }
  if (DRY) return;
  const bad = results.filter((r) => !r.ok);
  console.log(`\n새 게임 채우기 끝 — 단계 ${results.length}개 중 실패 ${bad.length}개${bad.length ? `: ${bad.map((r) => r.name).join(', ')}` : ''}`);
  if (bad.length) process.exitCode = 1;
}

main().catch((e) => { console.error(e.message); process.exit(1); });
