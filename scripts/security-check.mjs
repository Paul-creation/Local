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

  // 게시판: 쓰기는 서버 API(service role)로만, 브라우저 코드는 Supabase에 직접 쓰지 않음
  read('app/lib/community.ts').includes('SUPABASE_SERVICE_ROLE_KEY') ? ok('게시판 서버 모듈이 service role 사용') : bad('게시판 서버 모듈 없음 (app/lib/community.ts)');
  read('app/api/admin/community/route.ts').match(/isAdmin\(req\)/g)?.length >= 3 ? ok('게시판 관리자 API 인증') : bad('게시판 관리자 API에 인증 누락 (app/api/admin/community/route.ts)');
  const clientFiles = execSync("grep -rlE \"^'use client'|^\\\"use client\\\"\" app --include=*.ts --include=*.tsx || true").toString().trim().split('\n').filter(Boolean);
  const leaky = clientFiles.filter((f) => {
    const src = read(f);
    return /\.from\(['"](posts|post_comments|post_likes|post_reports)['"]\)/.test(src) ||
      /^import\s+(?!type\b)[^;]*from\s+['"][./]*(lib\/)?community['"]/m.test(src);
  });
  leaky.length === 0 ? ok('브라우저 코드에서 게시판 표 직접 접근 없음') : bad(`브라우저 코드가 게시판 표/서버 모듈에 직접 접근: ${leaky.join(', ')}`);
  const html = execSync('grep -rl dangerouslySetInnerHTML app/community app/components/community app/components/home/PopularPosts.tsx 2>/dev/null || true').toString().trim();
  html ? bad(`게시판에서 HTML 그대로 출력: ${html}`) : ok('게시판 본문을 글자 그대로 출력 (HTML 해석 없음)');
  /PUBLIC_POST\b/.test(read('app/community/post/[id]/page.tsx')) && !/select\(['"]\*/.test(read('app/lib/community.ts')) ? ok('게시판 읽기는 공개 칸만 선택') : bad('게시판 읽기에서 select * 사용 중 (해시 노출 위험)');

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

  // 게시판: 브라우저 키로 쓰기·수정·삭제·해시 읽기 모두 막혀 있어야 함
  const anyPost = (await admin.from('posts').select('id').limit(1)).data?.[0]?.id ?? 1;
  const cmRows = [
    ['posts', { board: 'free', title: '__security_test__', body: '__security_test__', nickname: '점검', password_hash: 'x', ip_hash: 'x' }],
    ['post_comments', { post_id: anyPost, body: '__security_test__', nickname: '점검', password_hash: 'x', ip_hash: 'x' }],
    ['post_likes', { post_id: anyPost, voter_hash: '__security_test__' }],
    ['post_reports', { target_type: 'post', target_id: anyPost, reporter_hash: '__security_test__' }],
  ];
  for (const [table, row] of cmRows) {
    const { error } = await anon.from(table).insert(row);
    if (error?.code === '42501') ok(`브라우저 키로 ${table} 쓰기 차단됨`);
    else if (error) note(`브라우저 키로 ${table} 쓰기 시도 → 권한이 아닌 다른 이유로 실패 (${error.message})`);
    else {
      bad(`브라우저 키로 ${table}에 쓸 수 있음!`, `${table}의 INSERT 정책 삭제`);
      const key = Object.keys(row).find((k) => String(row[k]).includes('__security_test__'));
      await admin.from(table).delete().eq(key, row[key]);
    }
  }
  const upd = await anon.from('posts').update({ title: '__security_test__' }).gte('id', 0).select('id');
  upd.error || (upd.data || []).length === 0 ? ok('브라우저 키로 posts 수정 차단됨') : bad(`브라우저 키로 posts ${upd.data.length}개 수정됨!`, 'posts의 UPDATE 정책 삭제');
  const del = await anon.from('posts').delete().gte('id', 0).select('id');
  del.error || (del.data || []).length === 0 ? ok('브라우저 키로 posts 삭제 차단됨') : bad(`브라우저 키로 posts ${del.data.length}개 삭제됨!`, 'posts의 DELETE 정책 삭제');
  for (const table of ['posts', 'post_comments']) {
    const { error } = await anon.from(table).select('password_hash, ip_hash').limit(1);
    error ? ok(`브라우저 키로 ${table}의 password_hash·ip_hash 읽기 차단됨`) : bad(`브라우저 키로 ${table}의 password_hash·ip_hash를 읽을 수 있음!`, 'revoke all on posts, post_comments, post_likes, post_reports from anon, authenticated; 실행');
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

  await checkCommunity(call, json);

  for (const path of ['/.env', '/.env.local']) {
    const res = await fetch(SITE + path).catch(() => null);
    !res || res.status === 404 ? ok(`${path} 외부 접근 불가`) : bad(`${path} 응답 ${res.status}`);
  }
}

// 게시판 실제 동작: 읽기 응답에 해시 없음, 입력 검증, 도배 제한
// 도배 제한 점검용 글·댓글은 '__security_test__' 제목으로 만들고 바로 숨긴 뒤 점검 끝에 지운다
async function checkCommunity(call, json) {
  const HASH = /password_hash|ip_hash|scrypt\$/;
  const latest = (await admin.from('posts').select('id').eq('hidden', false).order('id', { ascending: false }).limit(1)).data?.[0];
  const pages = ['/community', '/community/free', '/', ...(latest ? [`/community/post/${latest.id}`] : [])];
  for (const path of pages) {
    const res = await fetch(SITE + path).catch(() => null);
    const text = res ? await res.text() : '';
    if (!res || res.status !== 200) note(`${path} 응답 ${res?.status ?? '없음'} — 게시판이 아직 배포 안 됐을 수 있어요`);
    else HASH.test(text) ? bad(`${path} 응답에 password_hash·ip_hash가 들어 있음!`) : ok(`${path} 응답에 해시 없음`);
  }
  if (!latest) note('공개 글이 없어 글 상세 응답 점검은 건너뜀');

  const post = (b) => call('/api/community/posts', json('POST', { board: 'free', nickname: '보안점검', password: 'check1234', ...b }));
  let r = await post({ title: '__security_test__ 링크', body: 'https://a.com https://b.com https://c.com' });
  r.status === 400 ? ok('링크 3개 글 거절') : bad(`링크 3개 글 응답 ${r.status}`);
  if (r.body?.id) await admin.from('posts').delete().eq('id', r.body.id);
  r = await post({ title: '__security_test__ 금지어', body: '카지노 바카라 홍보' });
  r.status === 400 ? ok('금지어 글 거절') : bad(`금지어 글 응답 ${r.status}`);
  if (r.body?.id) await admin.from('posts').delete().eq('id', r.body.id);
  r = await post({ board: '__hack__', title: '__security_test__', body: '__security_test__' });
  r.status === 400 ? ok('없는 게시판 거절') : bad(`없는 게시판 응답 ${r.status}`);

  const created = [];
  try {
    let limited = false;
    for (let i = 0; i < 12 && !limited; i++) {
      r = await post({ title: `__security_test__ 도배 ${i}`, body: '도배 제한 점검용 글이에요' });
      if (r.status === 429) limited = true;
      else if (r.body?.id) { created.push(r.body.id); await admin.from('posts').update({ hidden: true }).eq('id', r.body.id); }
      else break;
    }
    limited ? ok(`글 도배 제한 동작 (하루 10개 넘으면 429)`) : bad(`글 도배 제한 없음 (${created.length}개까지 저장됨)`);

    const { data: tmp } = await admin.from('posts')
      .insert({ board: 'free', title: '__security_test__ 댓글 점검', body: '__security_test__', nickname: '보안점검', password_hash: 'x', ip_hash: 'x' })
      .select('id').single();
    if (tmp) {
      created.push(tmp.id);
      let cLimited = false, n = 0;
      for (let i = 0; i < 32 && !cLimited; i++) {
        r = await call(`/api/community/posts/${tmp.id}/comments`, json('POST', { body: `점검 ${i}`, nickname: '보안점검', password: 'check1234' }));
        if (r.status === 429) cLimited = true;
        else if (r.status === 200) { n++; if (HASH.test(JSON.stringify(r.body))) { bad('댓글 쓰기 응답에 해시가 들어 있음!'); break; } }
        else break;
      }
      cLimited ? ok('댓글 도배 제한 동작 (하루 30개 넘으면 429)') : bad(`댓글 도배 제한 없음 (${n}개까지 저장됨)`);
    }
  } finally {
    if (created.length) await admin.from('posts').delete().in('id', created);
  }
}

console.log('🔒 보안 점검 시작');
checkCode();
await checkDb();
await checkSite();
console.log(`\n결과: ✅ ${pass}  ❌ ${fail}  ⚠️ ${warn}`);
console.log(fail === 0 ? '🎉 막아야 할 건 전부 막혀 있어요' : '❌ 항목의 → 안내대로 처리한 뒤 다시 실행해 주세요');
console.log('\n※ 직접 확인: Vercel ADMIN_PASSWORD 변경, Anthropic 콘솔 월 한도');
