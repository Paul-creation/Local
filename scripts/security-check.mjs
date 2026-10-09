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
  read('app/api/admin/feedback/route.ts').match(/isAdmin\(req\)/g)?.length >= 2 ? ok('의견함 관리자 API 인증') : bad('의견함 관리자 API에 인증 누락 (app/api/admin/feedback/route.ts)');
  read('app/api/admin/reports/route.ts').match(/isAdmin\(req\)/g)?.length >= 2 ? ok('신고 목록 관리자 API 인증') : bad('신고 목록 관리자 API에 인증 누락 (app/api/admin/reports/route.ts)');
  read('app/api/admin/streamers/route.ts').match(/isAdmin\(req\)/g)?.length >= 2 ? ok('스트리머 관리자 API 인증') : bad('스트리머 관리자 API에 인증 누락 (app/api/admin/streamers/route.ts)');
  const clientFiles = execSync("grep -rlE \"^'use client'|^\\\"use client\\\"\" app --include=*.ts --include=*.tsx || true").toString().trim().split('\n').filter(Boolean);
  const leaky = clientFiles.filter((f) => {
    const src = read(f);
    return /\.from\(['"](posts|post_comments|post_likes|post_reports|game_comments|feedback)['"]\)/.test(src) ||
      /^import\s+(?!type\b)[^;]*from\s+['"][./]*(lib\/)?community['"]/m.test(src);
  });
  checkWebhook(clientFiles);
  leaky.length === 0 ? ok('브라우저 코드에서 게시판 표 직접 접근 없음') : bad(`브라우저 코드가 게시판 표/서버 모듈에 직접 접근: ${leaky.join(', ')}`);
  const html = execSync('grep -rl dangerouslySetInnerHTML app/community app/components/community app/components/home/PopularPosts.tsx 2>/dev/null || true').toString().trim();
  html ? bad(`게시판에서 HTML 그대로 출력: ${html}`) : ok('게시판 본문을 글자 그대로 출력 (HTML 해석 없음)');
  /PUBLIC_POST\b/.test(read('app/community/post/[id]/page.tsx')) && !/select\(['"]\*/.test(read('app/lib/community.ts')) ? ok('게시판 읽기는 공개 칸만 선택') : bad('게시판 읽기에서 select * 사용 중 (해시 노출 위험)');

  const authRoute = read('app/api/admin/auth/route.ts');
  /console\.log\([^)]*(password|ADMIN_PASSWORD)/i.test(authRoute)
    ? bad('관리자 로그인에서 비밀번호를 로그로 출력 중', '관리자 인증 패치')
    : ok('관리자 비밀번호 로그 출력 없음');

  checkUserLogin(clientFiles);

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

// 스팀 로그인: 사용자 접근은 app/lib/user/ 한 곳, 스팀 서버 재검증 필수, 세션 쿠키는 서버 코드만 다룸
function checkUserLogin(clientFiles) {
  if (!fs.existsSync('app/lib/user')) return note('스팀 로그인 코드 없음 (app/lib/user) — 로그인 점검 건너뜀');
  read('app/lib/user/index.ts').includes("import 'server-only'") ? ok('사용자 모듈이 server-only (브라우저에서 import하면 빌드 실패)') : bad('app/lib/user/index.ts에 server-only 표시 없음');
  const oid = read('app/lib/user/steamOpenId.ts');
  oid.includes('check_authentication') && oid.includes('is_valid:true') && oid.includes("op_endpoint !== STEAM_OPENID_ENDPOINT")
    ? ok('스팀 로그인: 스팀 서버 재검증(check_authentication)·op_endpoint 확인 적용') : bad('스팀 로그인 검증 코드가 빠졌거나 바뀜 (app/lib/user/steamOpenId.ts)');
  read('app/api/auth/steam/callback/route.ts').includes('verifySteamLogin') ? ok('로그인 콜백이 verifySteamLogin을 거침') : bad('로그인 콜백이 검증 없이 통과할 수 있음 (app/api/auth/steam/callback/route.ts)');
  const cb = read('app/api/auth/steam/callback/route.ts');
  cb.includes('consumeNonce') && cb.indexOf('consumeNonce') < cb.indexOf('upsertSteamUser') ? ok('로그인 콜백이 nonce 재사용을 막은 뒤에 사용자를 만듦') : bad('로그인 콜백에 nonce 재사용 차단이 없거나 순서가 틀림', 'consumeNonce를 upsertSteamUser보다 먼저 호출');
  /getSessionUserId/.test(read('app/api/me/owned/route.ts')) ? ok('/api/me/owned가 세션을 확인함') : bad('/api/me/owned에 세션 확인 없음');
  /LOGGED_IN_COOKIE, '1'/.test(read('app/lib/user/index.ts')) ? ok('logged_in 표시 쿠키 값은 항상 1 (개인정보 없음)') : bad('logged_in 표시 쿠키 값 확인 필요 (app/lib/user/index.ts)');
  const cookieUsers = execSync("grep -rlE \"user_session|USER_COOKIE|USER_SESSION_SECRET\" app proxy.ts --include=*.ts --include=*.tsx || true").toString().trim().split('\n')
    .filter((f) => f && !f.startsWith('app/lib/user/'));
  cookieUsers.length === 0 ? ok('사용자 세션 쿠키·비밀 키를 app/lib/user/ 밖에서 직접 다루지 않음') : bad(`사용자 세션을 모듈 밖에서 직접 다룸: ${cookieUsers.join(', ')}`, 'app/lib/user의 함수로만 접근');
  const leakyUser = clientFiles.filter((f) => /from\s+['"][./]*(lib\/)?user(\/[a-zA-Z]+)?['"]/.test(read(f)));
  leakyUser.length === 0 ? ok('브라우저 코드가 사용자 모듈을 가져오지 않음') : bad(`브라우저 코드가 사용자 모듈 import: ${leakyUser.join(', ')}`);
  /NEXT_PUBLIC_[A-Z_]*(STEAM_API|SESSION_SECRET)/.test(execSync("grep -rhE 'NEXT_PUBLIC_' app scripts proxy.ts .env.local 2>/dev/null || true").toString())
    ? bad('스팀 API 키·세션 비밀 키가 NEXT_PUBLIC_ 이름으로 쓰임') : ok('스팀 API 키·세션 비밀 키가 NEXT_PUBLIC_이 아님');
  /secure:\s*process\.env\.NODE_ENV === 'production'/.test(read('app/lib/user/session.ts')) && /httpOnly:\s*true/.test(read('app/lib/user/session.ts'))
    ? ok('세션 쿠키 httpOnly·Secure(운영)·SameSite 설정') : bad('세션 쿠키 속성 확인 필요 (app/lib/user/session.ts)');
}

// users 표: 브라우저 키로 읽기·쓰기 전부 차단 (서버 API로만)
async function checkUsersDb() {
  const probe = await anon.from('users').select('id, steam_id').limit(1);
  if (probe.error?.code === '42P01' || /does not exist|schema cache/i.test(probe.error?.message || '')) return note('users 표 없음 — supabase/migrations/20261016090000_users.sql 실행 전');
  probe.error ? ok('브라우저 키로 users 읽기 차단됨 (스팀 ID 비공개)') : bad('브라우저 키로 users를 읽을 수 있음!', 'revoke all on public.users from anon, authenticated; 실행');
  const ins = await anon.from('users').insert({ steam_id: '00000000000000000', persona_name: '__security_test__' });
  if (ins.error?.code === '42501') ok('브라우저 키로 users 쓰기 차단됨');
  else if (ins.error) note(`브라우저 키로 users 쓰기 시도 → 권한이 아닌 다른 이유로 실패 (${ins.error.message})`);
  else { bad('브라우저 키로 users에 쓸 수 있음!', 'revoke all on public.users from anon, authenticated; 실행'); await admin.from('users').delete().eq('steam_id', '00000000000000000'); }
  const upd = await anon.from('users').update({ persona_name: '__security_test__' }).eq('steam_id', '00000000000000000');
  upd.error?.code === '42501' ? ok('브라우저 키로 users 수정 차단됨') : bad(`브라우저 키로 users 수정 권한이 있음${upd.error ? ` (${upd.error.message})` : ''}`, 'revoke update on public.users from anon, authenticated; 실행');
}

// 보유 게임·nonce 표: 브라우저 키로 읽기·쓰기·교체 함수 실행 모두 차단
async function checkOwnedDb() {
  for (const [table, col, row] of [
    ['used_openid_nonces', 'nonce', { nonce: '__security_test__' }],
    ['user_owned_games', 'user_id', { user_id: '00000000-0000-0000-0000-000000000000', steam_appid: 1 }],
  ]) {
    const probe = await anon.from(table).select(col).limit(1);
    if (probe.error?.code === '42P01' || /does not exist|schema cache/i.test(probe.error?.message || '')) { note(`${table} 표 없음 — supabase/migrations/20261017090000_owned_games.sql 실행 전`); continue; }
    probe.error ? ok(`브라우저 키로 ${table} 읽기 차단됨`) : bad(`브라우저 키로 ${table}을 읽을 수 있음!`, `revoke all on public.${table} from anon, authenticated; 실행`);
    const ins = await anon.from(table).insert(row);
    if (ins.error?.code === '42501') ok(`브라우저 키로 ${table} 쓰기 차단됨`);
    else if (ins.error) note(`브라우저 키로 ${table} 쓰기 시도 → 권한이 아닌 다른 이유로 실패 (${ins.error.message})`);
    else { bad(`브라우저 키로 ${table}에 쓸 수 있음!`, `revoke all on public.${table} from anon, authenticated; 실행`); await admin.from(table).delete().eq(col, row[col]); }
  }
  const vis = await anon.from('users').select('owned_visibility').limit(1);
  if (vis.error && !/does not exist|schema cache/i.test(vis.error.message || '')) ok('브라우저 키로 users.owned_visibility 읽기 차단됨');
  else if (!vis.error) bad('브라우저 키로 users.owned_visibility를 읽을 수 있음!', 'revoke all on public.users from anon, authenticated; 실행');
  const rpc = await anon.rpc('replace_owned_games', { p_user: '00000000-0000-0000-0000-000000000000', p_appids: [] });
  if (/Could not find the function|does not exist/i.test(rpc.error?.message || '')) note('replace_owned_games 함수 없음 — owned_games.sql 실행 전');
  else rpc.error?.code === '42501' ? ok('브라우저 키로 replace_owned_games 실행 차단됨') : bad(`브라우저 키로 보유 게임 교체 함수를 실행할 수 있음!${rpc.error ? ` (${rpc.error.message})` : ''}`, 'revoke all on function public.replace_owned_games(uuid, bigint[]) from public, anon, authenticated; 실행');
}

// 디스코드 웹후크 주소는 서버에서만: NEXT_PUBLIC_ 이름 금지, 브라우저 코드에서 안 읽음, 빌드된 브라우저 번들에 없음
function checkWebhook(clientFiles) {
  const pub = execSync("grep -rlE 'NEXT_PUBLIC_[A-Z_]*(DISCORD|WEBHOOK)' app scripts proxy.ts next.config.ts .env.local 2>/dev/null || true").toString().trim();
  pub ? bad(`웹후크 주소를 NEXT_PUBLIC_ 이름으로 사용 중: ${pub.replace(/\n/g, ', ')}`, 'DISCORD_WEBHOOK_URL (NEXT_PUBLIC_ 없이)로 바꾸기') : ok('웹후크 환경변수가 NEXT_PUBLIC_이 아님');
  const usedInClient = clientFiles.filter((f) => /DISCORD_WEBHOOK_URL|discord(app)?\.com\/api\/webhooks|lib\/notify['"]/.test(read(f)));
  usedInClient.length === 0 ? ok('브라우저 코드에서 웹후크 사용 없음') : bad(`브라우저 코드가 웹후크/알림 모듈 사용: ${usedInClient.join(', ')}`);
  read('app/lib/notify.ts').includes("import 'server-only'") ? ok('알림 모듈이 server-only (브라우저에서 import하면 빌드 실패)') : bad('app/lib/notify.ts에 server-only 표시 없음');
  // 빌드 결과가 있으면 브라우저 번들(.next/static)을 직접 검색
  if (!fs.existsSync('.next/static')) return note('빌드 결과(.next/static)가 없어 번들 검사는 건너뜀 — npm run build 후 다시 실행하면 확인해요');
  const needles = ['discord.com/api/webhooks', 'discordapp.com/api/webhooks', 'DISCORD_WEBHOOK_URL', process.env.DISCORD_WEBHOOK_URL].filter(Boolean);
  const hits = execSync('grep -rlF ' + needles.map((n) => `-e '${n.replace(/'/g, '')}'`).join(' ') + ' .next/static 2>/dev/null || true').toString().trim();
  hits ? bad(`웹후크 URL이 브라우저 번들에 들어 있음: ${hits.split('\n').slice(0, 3).join(', ')}`, '웹후크는 서버 코드(app/lib/notify.ts)에서만 사용') : ok('웹후크 URL이 클라이언트 번들에 없음 (.next/static)');
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
  const anyGame = (await admin.from('games').select('id').limit(1)).data?.[0]?.id;
  const cmRows = [
    ['posts', { board: 'free', title: '__security_test__', body: '__security_test__', nickname: '점검', password_hash: 'x', ip_hash: 'x' }],
    ['post_comments', { post_id: anyPost, body: '__security_test__', nickname: '점검', password_hash: 'x', ip_hash: 'x' }],
    ['post_likes', { post_id: anyPost, voter_hash: '__security_test__' }],
    ['post_reports', { target_type: 'post', target_id: anyPost, reporter_hash: '__security_test__' }],
    ['game_comments', { game_id: anyGame, body: '__security_test__', nickname: '점검', password_hash: 'x', ip_hash: 'x' }],
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
  for (const table of ['posts', 'post_comments', 'game_comments']) {
    const { error } = await anon.from(table).select('password_hash, ip_hash').limit(1);
    error ? ok(`브라우저 키로 ${table}의 password_hash·ip_hash 읽기 차단됨`) : bad(`브라우저 키로 ${table}의 password_hash·ip_hash를 읽을 수 있음!`, 'revoke all on posts, post_comments, post_likes, post_reports from anon, authenticated; 실행');
  }

  // 추천 인원 투표: 쓰기는 서버 API(/api/player-votes)로만, 투표자 해시(voter_hash)는 브라우저에 비공개
  const pv = await anon.from('player_count_votes').insert({ game_id: anyGame, choice: '2', voter_hash: '__security_test__' });
  if (pv.error?.code === '42501') ok('브라우저 키로 player_count_votes 쓰기 차단됨');
  else if (pv.error) note(`브라우저 키로 player_count_votes 쓰기 시도 → 권한이 아닌 다른 이유로 실패 (${pv.error.message})`);
  else { bad('브라우저 키로 player_count_votes에 쓸 수 있음!', 'launch_extras SQL(RLS·revoke) 실행'); await admin.from('player_count_votes').delete().eq('voter_hash', '__security_test__'); }
  const pvr = await anon.from('player_count_votes').select('voter_hash').limit(1);
  pvr.error ? ok('브라우저 키로 player_count_votes의 voter_hash 읽기 차단됨') : bad('브라우저 키로 player_count_votes의 voter_hash를 읽을 수 있음!', 'launch_extras SQL의 칸 단위 grant 실행');

  // 의견함: 브라우저 키로 쓰기·읽기 전부 차단 (서버 API로만)
  const fb = await anon.from('feedback').insert({ kind: 'etc', body: '__security_test__', ip_hash: 'x' });
  if (fb.error?.code === '42501') ok('브라우저 키로 feedback 쓰기 차단됨');
  else if (fb.error) note(`브라우저 키로 feedback 쓰기 시도 → 권한이 아닌 다른 이유로 실패 (${fb.error.message})`);
  else { bad('브라우저 키로 feedback에 쓸 수 있음!', 'feedback SQL(RLS·revoke) 실행'); await admin.from('feedback').delete().eq('body', '__security_test__'); }
  const fr = await anon.from('feedback').select('id, contact, ip_hash').limit(1);
  fr.error ? ok('브라우저 키로 feedback 읽기 차단됨 (연락처·IP 해시 비공개)') : bad('브라우저 키로 feedback을 읽을 수 있음!', 'revoke all on public.feedback from anon, authenticated; 실행');

  await checkGameCommentsDb(anyGame);
  await checkUsersDb();
  await checkOwnedDb();
  await checkStreamerDb();

  const { count } = await admin.from('compare_cache').select('game_ids', { count: 'exact', head: true });
  count > 0 ? ok(`비교 캐시 저장 중 (${count}개 조합)`) : note('비교 캐시 0개 — 배포 후 비교 페이지를 한 번 열어보고 다시 점검');

  await checkSoloInTop();
}

// 스트리머 PICK 표: 브라우저 키는 공개 칸 읽기만, 숨김·확인 시각 칸과 쓰기·수정은 차단 (쓰기는 수집 스크립트·관리자 API만)
async function checkStreamerDb() {
  const pub = [
    ['streamer_channels', 'channel_id, streamer_name, channel_title, handle, kind'],
    ['streamer_videos', 'video_id, channel_id, game_id, title, published_at, view_count, is_short'],
  ];
  for (const [table, cols] of pub) {
    const { error } = await anon.from(table).select(cols).limit(1);
    if (error?.code === '42P01' || /does not exist|schema cache/i.test(error?.message || '')) return note('스트리머 표 없음 — supabase/migrations/20261014090000_streamer_videos.sql 실행 전');
    error ? bad(`브라우저 키로 ${table} 공개 칸을 못 읽음 (${error.message})`, '마이그레이션의 grant select 확인') : ok(`브라우저 키로 ${table} 공개 칸 읽기 가능`);
  }
  for (const [table, col] of [['streamer_channels', 'uploads_checked_at'], ['streamer_videos', 'hidden']]) {
    const { error } = await anon.from(table).select(col).limit(1);
    error ? ok(`브라우저 키로 ${table}.${col} 읽기 차단됨`) : bad(`브라우저 키로 ${table}.${col}을 읽을 수 있음!`, `revoke all on public.${table} from anon, authenticated; 후 공개 칸만 grant`);
  }
  const TEST_CH = 'UC__security_test__________';
  const ins = [
    ['streamer_channels', { channel_id: TEST_CH, streamer_name: '__security_test__', kind: 'main' }, 'channel_id', TEST_CH],
    ['streamer_videos', { video_id: '__sec_test_', channel_id: TEST_CH, game_id: '00000000-0000-0000-0000-000000000000', title: '__security_test__', published_at: new Date().toISOString(), match_method: 'title' }, 'video_id', '__sec_test_'],
  ];
  for (const [table, row, key, val] of ins) {
    const { error } = await anon.from(table).insert(row);
    if (error?.code === '42501') ok(`브라우저 키로 ${table} 쓰기 차단됨`);
    else if (error) note(`브라우저 키로 ${table} 쓰기 시도 → 권한이 아닌 다른 이유로 실패 (${error.message})`);
    else { bad(`브라우저 키로 ${table}에 쓸 수 있음!`, `revoke all on public.${table} from anon, authenticated; 실행`); await admin.from(table).delete().eq(key, val); }
  }
  // 수정: 없는 행을 대상으로 시도 → 권한 오류(42501)여야 통과 (실제 행은 바뀌지 않음)
  for (const [table, patch, key, val] of [['streamer_channels', { enabled: false }, 'channel_id', TEST_CH], ['streamer_videos', { hidden: true }, 'video_id', '__sec_test_']]) {
    const { error } = await anon.from(table).update(patch).eq(key, val);
    error?.code === '42501' ? ok(`브라우저 키로 ${table} 수정 차단됨`) : bad(`브라우저 키로 ${table} 수정 권한이 있음${error ? ` (${error.message})` : ''}`, `revoke update on public.${table} from anon, authenticated; 실행`);
  }
}

// 데이터 점검: 인기 상위 200개 중 1인용(max_players=1)이면 경고, 멀티 흔적(활동·태그·멀티 칸)이 있으면 따로 강조
// (TF2·CS2가 1~1에 멀티 칸까지 꺼져 있어 불일치 검사에 안 걸렸음)
async function checkSoloInTop() {
  const { data: top, error } = await admin.from('games')
    .select('name, heat_rank, max_players, activities, tags, has_online_coop, has_local_coop, has_pvp')
    .not('heat_rank', 'is', null).order('heat_rank').limit(200);
  if (error) return note(`인기 상위 게임 인원 점검 실패 (${error.message})`);
  const MULTI = /협력|협동|대전|멀티(?! ?엔딩)|PvP|팀|파티|친구|함께|온라인/i; // "멀티 엔딩"은 멀티플레이 아님
  const solo = top.filter((g) => g.max_players === 1);
  const suspect = solo.filter((g) => g.has_online_coop || g.has_local_coop || g.has_pvp ||
    [...(g.activities || []), ...(g.tags || [])].some((t) => MULTI.test(t)));
  const list = (games) => games.map((g) => `${g.name}(${g.heat_rank}위)`).join(', ');
  if (solo.length === 0) return ok('인기 상위 200개 중 1인용(max_players=1) 없음');
  note(`인기 상위 200개 중 1인용(max_players=1) ${solo.length}개 — 실제 1인용인지 확인 (docs/verification-rules.md): ${list(solo)}`);
  if (suspect.length) note(`  └ 그중 멀티 흔적(활동·태그·멀티 칸)이 있어 먼저 볼 게임 ${suspect.length}개: ${list(suspect)}`);
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

  // 추천 인원 투표 — 이상한 값·잘못된 ID·쿠키 없는 요청은 저장 전에 거절, 읽기 응답에 투표자 해시 없음
  const anyGameId = (await admin.from('games').select('id').gt('max_players', 1).limit(1)).data?.[0]?.id ?? '00000000-0000-0000-0000-000000000000';
  r = await call('/api/player-votes', json('POST', { gameId: anyGameId, choice: '__hack__' }));
  r.status === 400 ? ok('추천 인원 투표: 이상한 선택지 거절') : bad(`추천 인원 투표 이상한 선택지 응답 ${r.status}`);
  r = await call('/api/player-votes', json('POST', { gameId: 'not-a-uuid', choice: '2' }));
  r.status === 400 ? ok('추천 인원 투표: 잘못된 게임 ID 거절') : bad(`추천 인원 투표 잘못된 게임 ID 응답 ${r.status}`);
  r = await call('/api/player-votes', json('POST', { gameId: anyGameId, choice: '2' }));
  r.status === 400 ? ok('추천 인원 투표: 익명 쿠키 없는 요청 거절') : bad(`추천 인원 투표 쿠키 없는 요청 응답 ${r.status}`);
  r = await call(`/api/player-votes?gameId=${anyGameId}`);
  r.status === 200 && !JSON.stringify(r.body).includes('voter_hash') ? ok('추천 인원 투표: 읽기 응답에 투표자 해시 없음') : bad(`추천 인원 투표 읽기 응답 ${r.status} 또는 해시 노출`);

  r = await call('/api/compare-chat', json('POST', { question: '', gameInfo: '', history: [] }));
  r.body?.answer === '질문을 입력해주세요.' ? ok('비교 채팅 입력 검증 동작 (AI 호출 없음)') : bad('비교 채팅 입력 검증이 배포에 없음', 'aiGuard 패치 후 푸시');

  for (const path of ['/api/admin/feedback', '/api/admin/reports', '/api/admin/streamers']) {
    r = await call(path);
    r.status === 401 ? ok(`로그인 없이 ${path} 조회 차단`) : bad(`로그인 없이 ${path} 응답 ${r.status}`, '관리자 API에 isAdmin 확인');
  }
  r = await call('/api/feedback', json('POST', { kind: '__hack__', body: '__security_test__' }));
  r.status === 400 ? ok('의견함: 이상한 유형 거절') : bad(`의견함 이상한 유형 응답 ${r.status}`);
  r = await call('/api/feedback', json('POST', { kind: 'etc', body: '가'.repeat(1001) }));
  r.status === 400 ? ok('의견함: 1000자 넘는 본문 거절') : bad(`의견함 1000자 초과 응답 ${r.status}`);
  await checkSiteBundle();

  await checkCommunity(call, json);

  for (const path of ['/.env', '/.env.local']) {
    const res = await fetch(SITE + path).catch(() => null);
    !res || res.status === 404 ? ok(`${path} 외부 접근 불가`) : bad(`${path} 응답 ${res.status}`);
  }
}

// 배포 사이트의 브라우저 JS에 웹후크 주소가 없는지 (메인·의견함 페이지가 불러오는 /_next/static 파일 전부)
async function checkSiteBundle() {
  const scripts = new Set();
  for (const path of ['/', '/feedback']) {
    const html = await fetch(SITE + path).then((r) => r.text()).catch(() => '');
    for (const m of html.matchAll(/\/_next\/static\/[^"'\s)]+\.js/g)) scripts.add(m[0]);
  }
  if (!scripts.size) return note('배포 사이트에서 JS 파일을 찾지 못해 번들 검사는 건너뜀');
  const needles = ['discord.com/api/webhooks', 'discordapp.com/api/webhooks', process.env.DISCORD_WEBHOOK_URL].filter(Boolean);
  const leaked = [];
  for (const s of scripts) {
    const js = await fetch(SITE + s).then((r) => r.text()).catch(() => '');
    if (needles.some((n) => js.includes(n))) leaked.push(s);
  }
  leaked.length ? bad(`배포 사이트 JS에 웹후크 URL이 들어 있음: ${leaked.slice(0, 3).join(', ')}`, '웹후크 재발급 후 서버 코드에서만 사용') : ok(`웹후크 URL이 배포 사이트 클라이언트 번들에 없음 (JS ${scripts.size}개 검사)`);
}

// 게임 의견(game_comments) DB: 브라우저는 숨김 아닌 의견의 공개 칸만 읽기, 신고 1인 1회, cascade 삭제 시 신고 행 오류 없음
async function checkGameCommentsDb(gameId) {
  const { error: tblErr } = await admin.from('game_comments').select('id, game_id, body, nickname, password_hash, ip_hash, report_count, hidden, created_at').limit(1);
  if (tblErr) return bad('game_comments 테이블 없음', 'game_comments SQL 실행');
  ok('game_comments 테이블');
  const { data: rows } = await admin.from('game_comments').insert([
    { game_id: gameId, body: '__security_test__ 공개', nickname: '점검', password_hash: 'x', ip_hash: 'x', hidden: false },
    { game_id: gameId, body: '__security_test__ 숨김', nickname: '점검', password_hash: 'x', ip_hash: 'x', hidden: true },
  ]).select('id, hidden');
  if (!rows?.length) return bad('game_comments 점검용 행을 만들지 못함');
  try {
    const seen = (await anon.from('game_comments').select('id, body').like('body', '__security_test__%')).data || [];
    const shown = rows.find((r) => !r.hidden), hiddenRow = rows.find((r) => r.hidden);
    seen.some((r) => r.id === shown.id) ? ok('브라우저 키로 공개 의견 읽기 가능 (공개 칸만)') : note('브라우저 키로 공개 의견을 못 읽음 (서버로만 읽어서 사이트 동작엔 문제없음)');
    seen.some((r) => r.id === hiddenRow.id) ? bad('브라우저 키로 숨김 의견이 보임!', 'game_comments select 정책에 hidden = false 조건') : ok('브라우저 키로 숨김 의견 안 보임');

    const rep = (h) => admin.from('post_reports').insert({ target_type: 'game_comment', target_id: shown.id, reporter_hash: h });
    const r1 = await rep('__security_test__'), r2 = await rep('__security_test__');
    !r1.error && r2.error?.code === '23505' ? ok('같은 사람의 게임 의견 중복 신고는 1번만 기록') : bad(`게임 의견 신고 중복 처리 이상 (${r1.error?.message || r2.error?.message || '중복 허용'})`, 'post_reports target_type 제약에 game_comment 추가');
  } finally {
    const { error } = await admin.from('game_comments').delete().in('id', rows.map((r) => r.id));
    error ? bad(`신고가 달린 의견 삭제 오류: ${error.message}`) : ok('신고가 달린 의견을 지워도 오류 없음 (cascade 대비)');
    await admin.from('post_reports').delete().eq('reporter_hash', '__security_test__');
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

  // 신고: 없는 대상·숨김 대상은 저장 전에 404로 거절 (신고 기록이 쌓이지 않아야 함)
  for (const type of ['post', 'comment', 'game_comment']) {
    r = await call('/api/community/report', json('POST', { type, id: 999999999, reason: '기타' }));
    r.status === 404 ? ok(`없는 ${type} id 신고 거절`) : bad(`없는 ${type} id 신고 응답 ${r.status}`, '신고 API에서 대상 존재 확인');
  }
  const { data: hiddenPost } = await admin.from('posts')
    .insert({ board: 'free', title: '__security_test__ 숨김 신고', body: '__security_test__', nickname: '보안점검', password_hash: 'x', ip_hash: 'x', hidden: true })
    .select('id').single();
  if (hiddenPost) {
    r = await call('/api/community/report', json('POST', { type: 'post', id: hiddenPost.id }));
    r.status === 404 ? ok('숨김 글 신고 거절') : bad(`숨김 글 신고 응답 ${r.status}`, '신고 API에서 숨김 여부 확인');
    await admin.from('posts').delete().eq('id', hiddenPost.id);
  }
  const { count: strayReports } = await admin.from('post_reports').select('id', { count: 'exact', head: true }).eq('target_id', 999999999);
  !strayReports ? ok('없는 대상 신고 기록 0건') : bad(`없는 대상 신고 기록 ${strayReports}건 저장됨`);

  // 게임 의견: 게임 페이지 응답에 해시 없음 + 도배 제한(하루 30개). 점검용 의견은 바로 숨기고 끝에 지운다
  const game = (await admin.from('games').select('id').limit(1)).data?.[0];
  if (game) {
    const gp = await fetch(`${SITE}/games/${game.id}`).catch(() => null);
    const gt = gp ? await gp.text() : '';
    gp?.status === 200 && !HASH.test(gt) ? ok('게임 페이지 응답에 해시 없음') : bad(`게임 페이지 응답 이상 (${gp?.status ?? '없음'}${HASH.test(gt) ? ', 해시 포함!' : ''})`);
    gt.includes('의견 달기') ? ok('게임 페이지에 의견 달기 섹션') : note('게임 페이지에 의견 달기가 아직 없음 — 배포 전일 수 있어요');
    const opinion = (b) => call('/api/game-comments', json('POST', { gameId: game.id, nickname: '보안점검', password: 'check1234', ...b }));
    r = await opinion({ body: '__security_test__ https://a.com https://b.com https://c.com' });
    r.status === 400 ? ok('링크 3개 의견 거절') : bad(`링크 3개 의견 응답 ${r.status}`);
    r = await opinion({ body: '__security_test__' + '가'.repeat(200) });
    r.status === 400 ? ok('200자 넘는 의견 거절') : bad(`200자 넘는 의견 응답 ${r.status}`);
    const ids = [];
    try {
      let limited = false;
      for (let i = 0; i < 32 && !limited; i++) {
        r = await opinion({ body: `__security_test__ ${i}` });
        if (r.status === 429) limited = true;
        else if (r.body?.comment?.id) {
          ids.push(r.body.comment.id);
          await admin.from('game_comments').update({ hidden: true }).eq('id', r.body.comment.id);
          if (HASH.test(JSON.stringify(r.body))) { bad('의견 쓰기 응답에 해시가 들어 있음!'); break; }
        } else break;
      }
      limited ? ok('게임 의견 도배 제한 동작 (하루 30개 넘으면 429)') : bad(`게임 의견 도배 제한 없음 (${ids.length}개까지 저장됨)`);
    } finally {
      if (ids.length) await admin.from('game_comments').delete().in('id', ids);
    }
  }

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
