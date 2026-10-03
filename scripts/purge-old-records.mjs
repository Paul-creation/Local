// scripts/purge-old-records.mjs
// 개인정보처리방침 보유 기간: 신고(post_reports)·의견함(feedback)은 생성 1년 지나면 행 삭제
// 실행: node --env-file=.env.local scripts/purge-old-records.mjs [--dry-run]   (run-steps daily에 포함)
// - CLAUDE.md "기록 테이블 삭제 금지"의 예외로 허용된 삭제. 이 두 테이블 외에는 지우지 않는다
// - 안전장치: 지울 행 수·날짜 범위를 먼저 로그로 남기고, 한 테이블에서 MAX_DELETE개를 넘으면 아무것도 지우지 않고 실패 처리
//   (정상 운영이면 하루치 신고·의견만 대상. 갑자기 많으면 기준 시각 오류 등을 의심하고 사람이 확인)
//   확인 후 한꺼번에 지워야 하면 PURGE_MAX_DELETE=1000 처럼 환경변수로 한도를 올려 직접 실행
// - 신고 행을 지워도 대상 글의 report_count·hidden은 바뀌지 않음 (그 값은 글 쪽에 따로 저장, 다시 세지 않음)
// - 결과 수는 scripts/.cache/privacy-purge.json에 남겨 daily-summary가 요약에 한 줄로 보여준다
import { createClient } from '@supabase/supabase-js';
import { recordPurge } from './lib/privacy-purge.mjs';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const KEEP_DAYS = 365;
const MAX_DELETE = Number(process.env.PURGE_MAX_DELETE) || 200;
const DRY_RUN = process.argv.includes('--dry-run');
const cutoff = new Date(Date.now() - KEEP_DAYS * 24 * 60 * 60 * 1000).toISOString();

const TABLES = ['post_reports', 'feedback'];
const deleted = {};
let failed = false;

console.log(`기준: ${cutoff} 이전 생성 (${KEEP_DAYS}일) · 한 번 최대 ${MAX_DELETE}개${DRY_RUN ? ' · 미리보기(삭제 안 함)' : ''}`);

for (const table of TABLES) {
  deleted[table] = 0;
  const { data, error } = await supabase
    .from(table)
    .select('id, created_at')
    .lt('created_at', cutoff)
    .order('created_at', { ascending: true })
    .limit(MAX_DELETE + 1);
  if (error) {
    failed = true;
    console.error(`❌ ${table} 조회: ${error.message}`);
    continue;
  }
  if (!data.length) {
    console.log(`${table}: 지울 행 없음`);
    continue;
  }
  if (data.length > MAX_DELETE) {
    failed = true;
    console.error(`❌ ${table}: 대상이 ${MAX_DELETE}개를 넘어서 지우지 않음 → 확인 후 PURGE_MAX_DELETE로 한도를 올려 직접 실행`);
    continue;
  }

  const ids = data.map((r) => r.id);
  console.log(`${table}: ${ids.length}개 대상 (${data[0].created_at} ~ ${data[data.length - 1].created_at})`);
  console.log(`  id: ${ids.join(', ')}`);
  if (DRY_RUN) continue;

  // 조회한 id만 지운다 (조건으로 지우면 그 사이 기준이 어긋날 때 더 지울 수 있음)
  const { error: delErr, count } = await supabase.from(table).delete({ count: 'exact' }).in('id', ids).lt('created_at', cutoff);
  if (delErr) {
    failed = true;
    console.error(`❌ ${table} 삭제: ${delErr.message}`);
  } else {
    deleted[table] = count ?? 0;
    console.log(`  → ${deleted[table]}개 삭제`);
  }
}

if (!DRY_RUN) recordPurge({ reportsDeleted: deleted.post_reports, feedbackDeleted: deleted.feedback, recordsFailed: failed });
process.exit(failed ? 1 : 0);
