// scripts/purge-ip-hash.mjs
// 개인정보처리방침 "IP 해시 90일 보관" — 90일 지난 행의 IP 해시 칸만 비운다 (행은 지우지 않음)
// 실행: node --env-file=.env.local scripts/purge-ip-hash.mjs   (run-steps daily에 포함)
// - 한 번 비운 칸은 조건(is not null)에서 빠지므로 다시 처리하지 않음
// - 도배·횟수 제한은 최근 24시간 행만 보므로 90일 지난 칸을 비워도 영향 없음
// - post_likes.voter_hash는 기본키라 null 불가 → 무작위 값(expired:…)으로 바꿔 IP와의 연결만 끊음 (추천 수 유지)
// - 가격 기록 등 다른 테이블은 건드리지 않음
// 사전 조건: supabase/migrations/20261005090000_ip_hash_nullable.sql 실행 (NOT NULL 해제)
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { recordPurge } from './lib/privacy-purge.mjs';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const KEEP_DAYS = 90;
const cutoff = new Date(Date.now() - KEEP_DAYS * 24 * 60 * 60 * 1000).toISOString();

// [테이블, IP 해시 칸]
const NULLABLE = [
  ['posts', 'ip_hash'],
  ['post_comments', 'ip_hash'],
  ['game_comments', 'ip_hash'],
  ['feedback', 'ip_hash'],
  ['post_reports', 'reporter_hash'],
  ['game_votes', 'voter_hash'],
  ['ai_calls', 'ip'],
];
const EXPIRED = 'expired:';

let failed = false;
let cleared = 0;

for (const [table, col] of NULLABLE) {
  const { error, count } = await supabase
    .from(table)
    .update({ [col]: null }, { count: 'exact' })
    .not(col, 'is', null)
    .lt('created_at', cutoff);
  if (error) {
    failed = true;
    console.error(`❌ ${table}.${col}: ${error.message}`);
  } else {
    cleared += count ?? 0;
    console.log(`${table}.${col}: ${count ?? 0}개 비움`);
  }
}

// post_likes: 기본키(post_id, voter_hash)라 한 줄씩 무작위 값으로 교체
let likes = 0;
for (;;) {
  const { data, error } = await supabase
    .from('post_likes')
    .select('post_id, voter_hash')
    .not('voter_hash', 'like', `${EXPIRED}%`)
    .lt('created_at', cutoff)
    .limit(500);
  if (error) {
    failed = true;
    console.error(`❌ post_likes 조회: ${error.message}`);
    break;
  }
  if (!data.length) break;
  for (const row of data) {
    const { error: e } = await supabase
      .from('post_likes')
      .update({ voter_hash: EXPIRED + randomUUID() })
      .eq('post_id', row.post_id)
      .eq('voter_hash', row.voter_hash);
    if (e) {
      failed = true;
      console.error(`❌ post_likes ${row.post_id}: ${e.message}`);
    } else likes++;
  }
  if (failed) break;
}
console.log(`post_likes.voter_hash: ${likes}개 교체`);
console.log(`기준: ${cutoff} 이전 (${KEEP_DAYS}일)`);

recordPurge({ ipCleared: cleared + likes, ipFailed: failed });
process.exit(failed ? 1 : 0);
