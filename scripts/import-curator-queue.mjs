// scripts/import-curator-queue.mjs
// 관리자 "게시물 연결" 도구가 쌓은 추가 대기열(curator_game_queue)을 처리 — 데일리 첫 단계
// 실행: node --env-file=.env.local scripts/import-curator-queue.mjs           (미리보기 — 대기 중인 appid만 출력, DB·파일 안 건드림)
//       node --env-file=.env.local scripts/import-curator-queue.mjs --apply   (가져오기·보강·연결·imported_at 기록)
// 순서: DB에 없는 appid → bulk-import --curator --apply → (bulk-import가 끝에서 fill-new-game으로 새 게임 보강) → 같은 게시물에 curator_posts 연결 → imported_at 기록
// - 가격·리뷰·동접·ITAD는 이 단계 뒤의 데일리 단계가 모든 게임을 대상으로 받으므로 여기서 안 함. enrich-other-stores·ai-other·videos(--ids 없음)는 다음 weekly. 활동(fill-activities-v2, Sonnet)은 fill-new-game이 한 번에 최대 10개까지, 넘는 건 weekly
// - 못 가져온 appid(스팀 기준 미달 등)는 대기열에 남기고 14일 동안만 다시 시도. 이미 연결된 (계정, 게임, 게시물)은 건너뜀. 삭제 없음
// - 결과 숫자는 scripts/.cache/curator-queue.json → 일일 요약 "큐레이터 게임 추가 N개"
import { createClient } from '@supabase/supabase-js';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { pendingRows, buildLinks, recordQueueResult } from './lib/curator-queue.mjs';

const APPLY = process.argv.includes('--apply');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const envArgs = fs.existsSync('.env.local') ? ['--env-file=.env.local'] : [];
const CACHE = 'scripts/.cache';
const MAX_ROWS = 100;

function run(script, args) {
  return new Promise((resolve) => {
    console.log(`\n──── ▶ ${script} ${args.join(' ')}`);
    const child = spawn('node', [...envArgs, `scripts/${script}.mjs`, ...args], { stdio: 'inherit' });
    child.on('exit', (code) => resolve(code === 0));
  });
}

async function gamesByAppid(appids) {
  const map = new Map();
  for (let i = 0; i < appids.length; i += 100) {
    const { data, error } = await supabase.from('games').select('id, steam_appid, hidden').in('steam_appid', appids.slice(i, i + 100));
    if (error) throw new Error(`games 조회 실패: ${error.message}`);
    for (const g of data) map.set(String(g.steam_appid), g);
  }
  return map;
}

async function main() {
  const { data: all, error } = await supabase.from('curator_game_queue').select('*').is('imported_at', null).order('created_at').limit(MAX_ROWS);
  if (error) throw new Error(`대기열 조회 실패: ${error.message} (supabase/migrations/20261031090000_curator_game_queue.sql 실행 필요)`);
  const rows = pendingRows(all);
  const appids = [...new Set(rows.map((r) => String(r.appid)))];
  console.log(`${APPLY ? '반영' : '미리보기'} — 대기 ${rows.length}행 (appid ${appids.length}개, 14일 지난 ${all.length - rows.length}행 제외)`);
  if (!rows.length) return APPLY && recordQueueResult({ added: 0, linked: 0, left: 0 });

  const before = await gamesByAppid(appids);
  const missing = appids.filter((a) => !before.has(a));
  console.log(`DB에 이미 있는 appid ${appids.length - missing.length}개 · 새로 가져올 appid ${missing.length}개${missing.length ? `: ${missing.join(', ')}` : ''}`);
  if (!APPLY) return;

  fs.mkdirSync(CACHE, { recursive: true });
  let after = before;
  if (missing.length) {
    const listFile = `${CACHE}/curator-queue-appids.json`;
    fs.writeFileSync(listFile, JSON.stringify(missing.map((a) => ({ steam_appid: a }))));
    if (!(await run('bulk-import', ['--curator', listFile, '--apply']))) console.log('bulk-import가 오류로 끝났어요 — 들어온 게임까지만 이어서 처리');
    after = await gamesByAppid(appids);
  }
  const added = missing.filter((a) => after.has(a));
  console.log(`\n새로 들어온 게임 ${added.length}개 / 요청 ${missing.length}개`);

  // 새 게임 보강(태그·진입장벽·소개·활동 등)은 bulk-import --curator가 끝에서 fill-new-game으로 이미 함

  const visible = new Map([...after].filter(([, g]) => !g.hidden).map(([a, g]) => [a, g.id]));
  const { posts, doneIds, left } = buildLinks(rows, visible);
  let linked = 0;
  if (posts.length) {
    const { data, error: upErr } = await supabase
      .from('curator_posts')
      .upsert(posts, { onConflict: 'curator_id,game_id,post_url', ignoreDuplicates: true })
      .select('game_id');
    if (upErr) throw new Error(`curator_posts 연결 실패: ${upErr.message}`);
    linked = data?.length ?? 0;
  }
  if (doneIds.length) {
    const { error: doneErr } = await supabase.from('curator_game_queue').update({ imported_at: new Date().toISOString() }).in('id', doneIds);
    if (doneErr) throw new Error(`imported_at 기록 실패: ${doneErr.message}`);
  }
  console.log(`\n연결 ${linked}개 (이미 연결돼 있던 ${posts.length - linked}개 건너뜀) · 처리 완료 ${doneIds.length}행 · 못 가져와 대기 ${left.length}행`);
  recordQueueResult({ added: added.length, linked, left: left.length });
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
