// scripts/apply-intros.mjs
// data/intros/top100.json의 새 한 줄 소개(new_intro)를 games.fun_description에 반영
// 실행: node --env-file=.env.local scripts/apply-intros.mjs           (미리보기 — 바뀔 내용만 출력, DB는 안 건드림)
//       node --env-file=.env.local scripts/apply-intros.mjs --apply   (실제 반영)
// - 반영 전에 지금 DB 값을 data/intros/backup-<시각>.json으로 저장
// - DB 값이 파일의 old_intro와 다르면(그 사이 누가 고침) 덮어쓰지 않고 건너뜀
// - new_intro가 비어 있거나 이미 같은 값이면 건너뜀 → 여러 번 돌려도 안전
// - games.fun_description 한 칸만 바꿈. price_history 같은 기록 테이블은 건드리지 않음
import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync } from 'node:fs';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const APPLY = process.argv.includes('--apply');
const FILE = 'data/intros/top100.json';

async function main() {
  const rows = JSON.parse(readFileSync(FILE, 'utf8'));
  const { data: games, error } = await supabase.from('games').select('id, name, fun_description').in('id', rows.map((r) => r.game_id));
  if (error) return console.error('조회 실패:', error.message);
  const current = new Map(games.map((g) => [g.id, g]));

  const todo = [];
  const skipped = [];
  for (const r of rows) {
    const g = current.get(r.game_id);
    if (!r.new_intro) skipped.push(`${r.name} — 새 소개 없음`);
    else if (!g) skipped.push(`${r.name} — DB에 게임이 없음`);
    else if ((g.fun_description ?? null) === r.new_intro) skipped.push(`${r.name} — 이미 반영됨`);
    else if ((g.fun_description ?? null) !== (r.old_intro ?? null)) skipped.push(`${r.name} — 파일을 만든 뒤 DB 소개가 바뀌어서 덮어쓰지 않음`);
    else todo.push({ ...r, before: g.fun_description ?? null });
  }

  for (const t of todo) console.log(`✏️  ${t.name}\n    전: ${t.before ?? '(없음)'}\n    후: ${t.new_intro}\n`);
  if (skipped.length) console.log(`⏭️  건너뜀 ${skipped.length}개\n${skipped.map((s) => `    ${s}`).join('\n')}\n`);
  console.log(`바뀔 게임 ${todo.length}개`);

  if (!APPLY) return console.log('미리보기만 했어요. 반영하려면 --apply를 붙여 주세요');
  if (!todo.length) return;

  const backup = `data/intros/backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  writeFileSync(backup, JSON.stringify(todo.map((t) => ({ game_id: t.game_id, name: t.name, fun_description: t.before })), null, 2) + '\n');
  console.log(`💾 기존 소개 백업 → ${backup}`);

  let ok = 0;
  for (const t of todo) {
    // 조회한 뒤에 값이 바뀐 경우도 막으려고 기존 값이 그대로일 때만 바꿈
    let q = supabase.from('games').update({ fun_description: t.new_intro }, { count: 'exact' }).eq('id', t.game_id);
    q = t.before === null ? q.is('fun_description', null) : q.eq('fun_description', t.before);
    const { error: upErr, count } = await q;
    if (upErr) console.log(`❌ ${t.name}: ${upErr.message}`);
    else if (!count) console.log(`⏭️  ${t.name}: 반영 직전에 값이 바뀌어서 건너뜀`);
    else ok++;
  }
  console.log(`✅ ${ok}/${todo.length}개 반영 완료`);
}

main();
