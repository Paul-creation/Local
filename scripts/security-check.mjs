// scripts/security-check.mjs
// 보안·크레딧 보호가 제대로 적용됐는지 한 번에 점검
// 실행: node --env-file=.env.local scripts/security-check.mjs https://배포주소.vercel.app
import fs from 'fs';
import { execSync } from 'child_process';
import { createClient } from '@supabase/supabase-js';

const SITE = (process.argv[2] || process.env.SITE_URL || '').replace(/\/$/, '');
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const admin = createClient(URL_, process.env.SUPABASE_SERVICE_ROLE_KEY);
const anon = createClient(URL_, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

let pass = 0, fail = 0, warn = 0;
const ok = (m) => { pass++; console.log(`  ✅ ${m}`); };
const bad = (m, fix) => { fail++; console.log(`  ❌ ${m}${fix ? `\n     → ${fix}` : ''}`); };
const note = (m) => { warn++; console.log(`  ⚠️  ${m}`); };
const read = (p) => (fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '');

function checkCode() {
  console.log('\n[1] 코드 적용 여부');
  const files = [
    ['app/lib/aiGuard.ts', 'guardedClaudeFetch', 'AI 한도 모듈', 'aiGuard 터미널 패치'],
    ['app/api/recommend/route.ts', 'guardedClaudeFetch', 'AI 추천 한도', 'aiGuard 터미널 패치'],
    ['app/api/compare-chat/route.ts', 'guardedClaudeFetch', '비교 채팅 한도', 'aiGuard 터미널 패치'],
    ['app/compare/page.tsx', 'guardedClaudeFetch', '상황별 추천도 한도', 'aiGuard 터미널 패치'],
    ['app/compare/page.tsx', 'cacheDb', '비교 캐시 서버 키 사용', '관리자 인증·캐시 패치'],
    ['app/lib/adminAuth.ts', 'isAdmin', '관리자 세션 모듈', '관리자 인증 패치'],
    ['app/api/admin/games/route.ts', 'isAdmin(req)', '관리자 API 인증', '관리자 인증 패치'],
    ['app/api/votes/route.ts', 'VOTE_SITUATIONS', '투표 검증', '투표 패치'],
    ['scripts/enrich-ai-other.mjs', 'ai_enriched_at', 'AI 보강 스크립트 중복 호출 방지', 'aiGuard 터미널 패치'],
  ];
  for (const [p, mark, label, fix] of files) {
    read(p).includes(mark) ? ok(label) : bad(`${label} (${p})`, fix);
  }

  const authRoute = read('app/api/admin/auth/route.ts');
  /console\.log\([^)]*(password|ADMIN_PASSWORD)/i.test(authRoute)
    ? bad('관리자 로그인에서 비밀번호를 로그로 출력 중', '관리자 인증 패치')
    : ok('관리자 비밀번호 로그 출력 없음');

  const direct = execSync("grep -rl \"fetch('https://api.anthropic.com\" app --include=*.ts --include=*.tsx || true").toString().trim()
    .split('\n').filter((f) => f && !f.endsWith('aiGuard.ts'));
  direct.length === 0 ? ok('한도를 거치지 않는 AI 호출 없음') : bad(`한도 없이 AI를 부르는 파일: ${direct.join(', ')}`);

  try {
    const tracked = execSync('git ls-files').toString().split('\n').filter((f) => /(^|\/)\.env/.test(f));
    tracked.length === 0 ? ok('.env 파일이 git에 올라가 있지 않음') : bad(`git에 올라간 env 파일: ${tracked.join(', ')}`, '파일 삭제 후 키 전부 재발급');
  } catch { note('git 확인 불가'); }

  try {
    const pending = execSync('git status --porcelain app scripts').toString().trim();
    pending ? note('아직 커밋·푸시 안 된 변경이 있어요 → 배포 사이트에는 반영 안 됨') : ok('변경 사항 모두 커밋됨');
  } catch {}
}

async function checkDb() {
  console.log('\n[2] DB 설정');
  const col = async (table, column, label, fix) => {
    const { error } = await admin.from(table).select(column).limit(1);
    error ? bad(label, fix) : ok(label);
  };
  await col('ai_calls', 'id, ip, kind, created_at', 'ai_calls 테이블', 'ai_calls SQL 실행');
  await col('games', 'ai_enriched_at', 'games.ai_enriched_at 컬럼', 'ai_enriched_at SQL 실행');
  await col('game_votes', 'voter_hash, created_at', 'game_votes 투표자 컬럼', '투표 SQL 실행');

  const tests = [
    ['games', { name: '__security_test__' }],
    ['price_history', { price: 1 }],
    ['compare_cache', { game_ids: '__security_test__', situation_scores: [] }],
    ['game_votes', { situation: '__security_test__' }],
    ['ai_calls', { ip: '__security_test__', kind: 'test' }],
  ];
  for (const [table, row] of tests) {
    const { error } = await anon.from(table).insert(row);
    if (error) ok(`브라우저 키로 ${table} 쓰기 차단됨`);
    else {
      bad(`브라우저 키로 ${table}에 쓸 수 있음!`, `${table}의 INSERT 정책 삭제`);
      const key = Object.keys(row)[0];
      await admin.from(table).delete().eq(key, row[key]);
    }
  }

  const { count } = await admin.from('compare_cache').select('game_ids', { count: 'exact', head: true });
  count > 0 ? ok(`비교 캐시 저장 중 (${count}개 조합)`) : note('비교 캐시 0개 — 배포 후 비교 페이지를 한 번 열어보고 다시 점검');
}

async function checkSite() {
  console.log(`\n[3] 배포 사이트 (${SITE || '주소 없음'})`);
  if (!SITE) return note('사이트 주소를 넣으면 실제 동작도 점검해요: node ... security-check.mjs https://주소');

  const call = async (path, init) => {
    try {
      const r = await fetch(SITE + path, init);
      let body = {};
      try { body = await r.json(); } catch {}
      return { status: r.status, body };
    } catch (e) { return { status: 0, body: { error: e.message } }; }
  };
  const json = (method, body) => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

  // PROTECTION_CHECK — Vercel 배포 보호(로그인 화면)가 대신 응답하면 점검이 무의미하므로 중단
  try {
    const probe = await fetch(SITE + '/api/votes?gameId=probe');
    const type = probe.headers.get('content-type') || '';
    if (!type.includes('application/json')) {
      note(`이 주소는 API 대신 ${probe.status} ${type.split(';')[0] || '페이지'}를 돌려줘요 → Vercel 배포 보호가 걸린 미리보기 주소예요. Production 도메인으로 다시 실행해 주세요`);
      return;
    }
  } catch (e) {
    return note('사이트에 연결할 수 없어요: ' + e.message);
  }

  let r = await call('/api/admin/games');
  r.status === 401 ? ok('로그인 없이 관리자 게임 목록 조회 차단') : bad(`로그인 없이 관리자 조회 가능 (응답 ${r.status})`, '관리자 인증 패치 후 푸시');

  r = await call('/api/admin/games', json('PATCH', { id: '00000000-0000-0000-0000-000000000000', tags: ['hack'] }));
  r.status === 401 ? ok('로그인 없이 게임 수정 차단') : bad(`로그인 없이 게임 수정 가능 (응답 ${r.status})`, '관리자 인증 패치 후 푸시');

  r = await call('/api/admin/auth', json('POST', { password: '__wrong__' }));
  r.status === 401 ? ok('틀린 관리자 비밀번호 거절') : bad(`틀린 비밀번호 응답 ${r.status}`);

  r = await call('/api/votes', json('POST', { gameId: '00000000-0000-0000-0000-000000000000', situation: '__hack__' }));
  r.status === 400 ? ok('이상한 투표 값 거절') : bad(`이상한 투표 값 응답 ${r.status}`, '투표 패치 후 푸시');

  r = await call('/api/votes', json('POST', { gameId: 'not-a-uuid', situation: '혼자 심심할 때' }));
  r.status === 400 ? ok('잘못된 게임 ID 투표 거절') : bad(`잘못된 게임 ID 응답 ${r.status}`, '투표 패치 후 푸시');

  r = await call('/api/compare-chat', json('POST', { question: '', gameInfo: '', history: [] }));
  r.body?.answer === '질문을 입력해주세요.' ? ok('비교 채팅 입력 검증 동작 (AI 호출 없음)') : bad('비교 채팅 입력 검증이 배포에 없음', 'aiGuard 패치 후 푸시');

  for (const path of ['/.env', '/.env.local']) {
    const res = await fetch(SITE + path).catch(() => null);
    !res || res.status === 404 ? ok(`${path} 외부 접근 불가`) : bad(`${path} 응답 ${res.status}`);
  }
}

console.log('🔒 보안 점검 시작');
checkCode();
await checkDb();
await checkSite();
console.log(`\n결과: ✅ ${pass}  ❌ ${fail}  ⚠️ ${warn}`);
console.log(fail === 0 ? '🎉 막아야 할 건 전부 막혀 있어요' : '❌ 항목의 → 안내대로 처리한 뒤 다시 실행해 주세요');
console.log('\n※ 직접 확인: Vercel ADMIN_PASSWORD 변경, Anthropic 콘솔 월 한도');
