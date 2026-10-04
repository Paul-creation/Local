// scripts/backup-export.mjs
// 주간 백업: games와 가격 기록(price_history)만 JSON으로 내보내기 (읽기 전용, DB는 바꾸지 않음)
// - 개인정보가 있는 표(posts, post_comments, game_comments, feedback, post_reports, ai_calls 등)는 내보내지 않는다
//   → 표를 추가하려면 TABLES에 넣되, 닉네임·IP 해시·비밀번호 해시가 있는 표는 넣지 않는다
// - 결과: backup/<표>.json (+ backup/manifest.json 행 수·시각). GitHub Actions(backup.yml)가 아티팩트로 30일 보관
// 실행: node --env-file=.env.local scripts/backup-export.mjs
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const TABLES = ['games', 'price_history'];
const PAGE = 1000; // Supabase 기본 최대 응답 행 수
const OUT = 'backup';

async function dump(table) {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase.from(table).select('*').order('id').range(from, from + PAGE - 1);
    if (error) throw new Error(`${table} 읽기 실패: ${error.message}`);
    rows.push(...data);
    if (data.length < PAGE) break;
  }
  // 페이지를 나눠 읽는 사이 행이 늘거나 줄었는지 확인 (어긋나면 백업 실패로 처리해 다시 돌리게)
  const { count, error } = await supabase.from(table).select('id', { count: 'exact', head: true });
  if (error) throw new Error(`${table} 행 수 확인 실패: ${error.message}`);
  if (count !== rows.length) throw new Error(`${table}: 읽은 행 ${rows.length}개, 현재 ${count}개 — 다시 실행해주세요`);
  fs.writeFileSync(`${OUT}/${table}.json`, JSON.stringify(rows));
  return rows.length;
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const counts = {};
  for (const t of TABLES) {
    counts[t] = await dump(t);
    console.log(`✅ ${t}: ${counts[t]}행`);
  }
  fs.writeFileSync(`${OUT}/manifest.json`, JSON.stringify({ exported_at: new Date().toISOString(), counts }, null, 1));
}

main().catch((e) => { console.error(`❌ ${e.message}`); process.exit(1); });
