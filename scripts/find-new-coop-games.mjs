// scripts/find-new-coop-games.mjs
// 주간 스팀 협동 신작 자동 추가 — 최근 출시된 협동 게임 + 곧 나올 인기 협동 게임을 찾아 games에 넣음 (weekly, bulk-import 다음 단계)
// 실행: node --env-file=.env.local scripts/find-new-coop-games.mjs                         (미리보기 — 후보 표만 출력, DB 안 건드림)
//       node --env-file=.env.local scripts/find-new-coop-games.mjs --apply                 (통과한 후보를 bulk-import --curator --apply로 추가)
//       node --env-file=.env.local scripts/find-new-coop-games.mjs --backfill-days 30      (출시작 기간을 30일로 — 첫 실행에 밀린 신작 채울 때 한 번만, --apply와 같이 써도 됨)
// 기준 (scripts/lib/new-coop-rules.mjs)
//   공통: 스팀 카테고리에 협동(9) 또는 온라인 협동(38) 필수 (멀티·PvP만 있는 게임 제외), 종류 game, 성인 콘텐츠 표시(1·3·4번)·제외 장르 제외, 이미 games에 있는 appid(hidden 포함)·판매 중단 목록 제외
//   출시작: 최근 14일(--backfill-days로 변경) 안 출시 + 리뷰 50개 이상
//   출시 예정작: 출시일이 60일 안 + 스팀 "인기 출시 예정" 30위 안 (팔로워 수는 로그인 없이 못 받아 이 순위로 대신함)
//   주 최대 30개 — 넘으면 출시작은 리뷰 많은 순, 출시 예정작은 출시일 가까운 순 (출시 예정작 최소 10자리)
// 데이터: 스팀 검색(협동·온라인 협동 카테고리를 하나씩 검색해 합침) → IStoreBrowseService/GetItems(100개씩, 종류·카테고리·출시일·리뷰) → appdetails(통과 후보만, 성인·장르). 요청 간격 2초(steam.mjs), AI 안 씀
// 추가는 bulk-import --curator를 그대로 씀 (출시 예정작 처리·카테고리·크로스플레이 저장 재사용). 이 단계에서 새로 넣은 게임은 weekly 뒤 단계와 daily가 채움
// 끝나면: 추가된 게임이 있으면 /api/admin/revalidate 호출, Actions 요약(GITHUB_STEP_SUMMARY)에 추가 목록, scripts/.cache/new-coop-added.json에 결과 저장
import { createClient } from '@supabase/supabase-js';
import { spawnSync } from 'node:child_process';
import { writeFileSync, appendFileSync, mkdirSync } from 'node:fs';
import { steamGet, appdetailsUrl } from './lib/steam.mjs';
import { normalizeItem, firstPass, releasedQuality, secondPass, rankPassed, WINDOW_DAYS, WEEKLY_MAX, UPCOMING_TOP_RANK, UPCOMING_WITHIN_DAYS, MIN_REVIEWS } from './lib/new-coop-rules.mjs';

const APPLY = process.argv.includes('--apply');
const bi = process.argv.indexOf('--backfill-days');
const WINDOW = bi >= 0 ? Number(process.argv[bi + 1]) : WINDOW_DAYS;
if (bi >= 0 && !(WINDOW >= 1 && WINDOW <= 90)) { console.error('--backfill-days는 1~90 사이 숫자여야 해요'); process.exit(1); }

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const nowTs = Math.floor(Date.now() / 1000);
const SEARCH = 'https://store.steampowered.com/search/results?json=1&cc=kr&l=english&category1=998';
const SEARCH_CATEGORIES = [9, 38]; // 협동·온라인 협동 — category3에 쉼표로 여럿 주면 AND라서 하나씩 검색해 합침
const MAX_RELEASED_PAGES = 12; // 100개씩, 보통 기간을 넘기는 페이지가 나오면 거기서 멈춤
const UPCOMING_PAGES = 1; // 인기 출시 예정 상위 100
const getItemsUrl = (appids) => `https://api.steampowered.com/IStoreBrowseService/GetItems/v1/?input_json=${encodeURIComponent(JSON.stringify({ ids: appids.map((a) => ({ appid: Number(a) })), context: { language: 'english', country_code: 'KR' }, data_request: { include_reviews: true, include_release: true } }))}`;
const fmtDate = (ts) => (ts ? new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date(ts * 1000)) : '-');
const appidOf = (x) => x.logo?.match(/\/apps\/(\d+)\//)?.[1];
const cache = new Map();

async function searchPage(extra, start, cat) {
  const json = await steamGet(`${SEARCH}&category3=${cat}&${extra}&start=${start}&count=100`);
  return (json.items || []).map((x) => ({ appid: appidOf(x), name: x.name })).filter((x) => x.appid);
}
async function loadItems(appids) {
  const need = appids.filter((a) => !cache.has(a));
  for (let i = 0; i < need.length; i += 100) {
    const json = await steamGet(getItemsUrl(need.slice(i, i + 100)), { gapMs: 1000 });
    for (const it of json?.response?.store_items ?? []) { const c = normalizeItem(it); cache.set(c.appid, c); }
  }
}

async function revalidate() {
  const key = process.env.ADMIN_REVALIDATE_KEY;
  if (!key) { console.log('ℹ️  ADMIN_REVALIDATE_KEY 없음 — 캐시 무효화 생략 (5분 뒤 저절로 갱신)'); return; }
  const site = (process.env.NEXT_PUBLIC_SITE_URL || 'https://jamidunow.com').replace(/\/$/, '');
  try {
    const res = await fetch(`${site}/api/admin/revalidate`, { method: 'POST', headers: { 'x-admin-key': key } });
    console.log(res.ok ? '♻️  캐시 무효화 (/api/admin/revalidate)' : `⚠️ 캐시 무효화 실패 (${res.status})`);
  } catch (e) { console.log(`⚠️ 캐시 무효화 실패 (${e.message})`); }
}

async function main() {
  console.log(`${APPLY ? '반영' : '미리보기(DB 쓰기 없음)'} — 최근 ${WINDOW}일 협동 신작(리뷰 ${MIN_REVIEWS}개 이상) + ${UPCOMING_WITHIN_DAYS}일 안 출시 예정 인기 ${UPCOMING_TOP_RANK}위 안\n`);
  const { data: existing, error } = await supabase.from('games').select('steam_appid'); // hidden 포함
  if (error) throw new Error(`games 조회 실패: ${error.message}`);
  const have = new Set((existing || []).map((g) => String(g.steam_appid)));
  const { data: del } = await supabase.from('delisted_appids').select('steam_appid');
  const delisted = new Set((del || []).map((d) => String(d.steam_appid)));

  // 1) 후보 모으기
  const names = new Map();
  for (const cat of SEARCH_CATEGORIES) {
    for (let p = 0; p < MAX_RELEASED_PAGES; p++) {
      const page = await searchPage('sort_by=Released_DESC', p * 100, cat);
      if (!page.length) break;
      await loadItems(page.map((x) => x.appid));
      for (const x of page) names.set(x.appid, x.name);
      const ts = page.map((x) => cache.get(x.appid)?.releaseTs).filter(Boolean);
      if (ts.length && (nowTs - Math.min(...ts)) / 86400 > WINDOW + 14) break; // 기간을 충분히 넘김 (아까운 후보용 여유 14일)
    }
  }
  const rankOf = new Map(); // 협동·온라인 협동 인기 출시 예정 목록에서의 순위 중 높은 것
  for (const cat of SEARCH_CATEGORIES) {
    for (let p = 0; p < UPCOMING_PAGES; p++) {
      const page = await searchPage('filter=popularcomingsoon', p * 100, cat);
      page.forEach((x, i) => { const r = p * 100 + i + 1; if (!rankOf.has(x.appid) || r < rankOf.get(x.appid)) rankOf.set(x.appid, r); names.set(x.appid, x.name); });
      await loadItems(page.map((x) => x.appid));
    }
  }
  const all = [...new Set([...names.keys()])];
  console.log(`후보 ${all.length}개 (출시일순·인기 출시 예정순, 겹치면 한 번만 셈)\n`);

  // 2) 1차 판정 (GetItems 값만) + 출시작 리뷰 기준
  const rows = [];
  for (const appid of all) {
    const c = cache.get(appid);
    if (!c) { rows.push({ c: { appid, name: names.get(appid) || '', categories: [], reviews: 0 }, status: 'drop', reason: '스팀 상세 응답 없음' }); continue; }
    const row = { c, rank: rankOf.get(appid) ?? null };
    if (delisted.has(appid)) { rows.push({ ...row, status: 'skip-have', reason: '판매 중단 목록' }); continue; }
    if (have.has(appid)) { rows.push({ ...row, status: 'skip-have', reason: '이미 games에 있음' }); continue; }
    const fp = firstPass(c, { nowTs, rank: row.rank, windowDays: WINDOW });
    if (fp.drop) {
      const age = c.releaseTs ? (nowTs - c.releaseTs) / 86400 : 999;
      const near = !c.comingSoon && c.type === 0 && c.categories.length && age > WINDOW && age <= WINDOW + 14 && c.reviews >= 200;
      rows.push({ ...row, status: near ? 'near' : 'drop', reason: fp.reason });
      continue;
    }
    row.kind = fp.kind;
    if (fp.kind === 'released') {
      const q = releasedQuality(c);
      row.reason = q.why;
      if (!q.ok) { rows.push({ ...row, status: c.reviews >= 30 ? 'near' : 'drop', reason: `리뷰 기준 미달 (${q.why})` }); continue; }
    }
    rows.push({ ...row, status: 'cand' });
  }

  // 3) 2차 판정 (appdetails) — 통과 후보만
  for (const r of rows.filter((x) => x.status === 'cand')) {
    try {
      const res = (await steamGet(appdetailsUrl(r.c.appid, 'english', 'kr')))?.[r.c.appid];
      if (!res?.success) { r.status = 'drop'; r.reason = '스팀 상점 정보 없음 (지역 제한 등)'; continue; }
      const sp = secondPass(res.data);
      if (!sp.ok) { r.status = 'drop'; r.reason = sp.reason; continue; }
      r.status = 'pass';
      r.reason = r.kind === 'upcoming' ? `인기 출시 예정 ${r.rank}위` : r.reason;
    } catch (e) { r.status = 'drop'; r.reason = `확인 실패: ${e.message}`; }
  }

  // 4) 출력
  const passed = rows.filter((r) => r.status === 'pass').map((r) => ({ ...r, reviews: r.c.reviews, releaseTs: r.c.releaseTs }));
  const top = rankPassed(passed, WEEKLY_MAX);
  const topIds = new Set(top.map((r) => r.c.appid));
  const cell = (s) => String(s ?? '').replace(/\|/g, '/');
  const line = (r) => `| ${cell(r.c.name)} | ${r.c.appid} | ${r.c.comingSoon ? '출시 예정' : '출시'} ${fmtDate(r.c.releaseTs)} | ${r.c.categories.join(', ') || '-'} | ${r.c.comingSoon ? `인기순위 ${r.rank ?? '-'}` : `리뷰 ${r.c.reviews}`} | ${r.status === 'pass' ? (topIds.has(r.c.appid) ? '통과 ✅' : '통과 (주 30개 초과)') : r.reason} |`;
  const head = '| 이름 | appid | 출시일·상태 | 협동 카테고리 | 리뷰/순위 | 통과/탈락 이유 |\n|---|---|---|---|---|---|';
  const rel = top.filter((r) => r.kind === 'released');
  const up = top.filter((r) => r.kind === 'upcoming');
  console.log(`## 통과 ${passed.length}개 (이번 추가 대상 ${top.length}개 = 출시작 ${rel.length} + 출시 예정 ${up.length})\n${head}`);
  for (const r of [...rel, ...up]) console.log(line(r));
  const over = passed.filter((r) => !topIds.has(r.c.appid));
  if (over.length) { console.log(`\n### 통과했지만 주 ${WEEKLY_MAX}개 초과로 밀린 것 ${over.length}개\n${head}`); for (const r of over) console.log(line(r)); }
  const near = rows.filter((r) => r.status === 'near');
  console.log(`\n## 아까운 탈락 ${near.length}개 (상위 10)\n${head}`);
  for (const r of near.sort((a, b) => b.c.reviews - a.c.reviews).slice(0, 10)) console.log(line(r));
  const reasons = new Map();
  for (const r of rows.filter((x) => x.status === 'drop' || x.status === 'near')) { const k = r.reason.replace(/\d+/g, 'N').replace(/\(.*\)/, '').trim(); reasons.set(k, (reasons.get(k) || 0) + 1); }
  console.log(`\n## 요약\n- 이미 games에 있음(hidden·판매 중단 포함) ${rows.filter((r) => r.status === 'skip-have').length}개`);
  for (const [k, n] of [...reasons].sort((a, b) => b[1] - a[1])) console.log(`- 탈락: ${k} ${n}개`);

  mkdirSync('scripts/.cache', { recursive: true });
  writeFileSync('scripts/.cache/new-coop-preview.json', JSON.stringify({ at: new Date().toISOString(), windowDays: WINDOW, rows }, null, 1));
  if (!APPLY) { console.log('\n미리보기만 했어요. DB는 안 건드렸어요. 반영하려면 --apply'); return; }
  if (!top.length) { console.log('\n추가할 게임이 없어요.'); writeSummary([]); return; }

  // 5) 추가 — bulk-import --curator를 그대로 씀 (출시 예정작·카테고리·크로스플레이 저장 재사용)
  const listFile = 'scripts/.cache/new-coop-list.json';
  writeFileSync(listFile, JSON.stringify(top.map((r) => ({ steam_appid: r.c.appid, name: r.c.name })), null, 1));
  const envArgs = process.execArgv.filter((a) => a.startsWith('--env-file'));
  console.log(`\n▶ bulk-import --curator ${listFile} --apply (${top.length}개)\n`);
  const res = spawnSync('node', [...envArgs, 'scripts/bulk-import.mjs', '--curator', listFile, '--apply'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  process.stdout.write(res.stdout || '');
  if (res.stderr) process.stderr.write(res.stderr);
  const added = [...(res.stdout || '').matchAll(/✅ 추가됨: (.+) \((\d+)\) —/g)].map((m) => {
    const r = top.find((x) => x.c.appid === m[2]);
    return { appid: m[2], name: m[1], kind: r?.kind, release: fmtDate(r?.c.releaseTs), reviews: r?.c.reviews ?? 0 };
  });
  console.log(`\n이번에 추가된 게임 ${added.length}개 (대상 ${top.length}개 중)`);
  writeSummary(added);
  if (added.length) await revalidate();
  if (res.status !== 0) process.exit(1);
}

function writeSummary(added) {
  writeFileSync('scripts/.cache/new-coop-added.json', JSON.stringify({ at: new Date().toISOString(), windowDays: WINDOW, added }, null, 1));
  if (!process.env.GITHUB_STEP_SUMMARY) return;
  const lines = [`## 이번 주 추가된 협동 신작 ${added.length}개`, ''];
  if (added.length) lines.push('| 이름 | appid | 구분 | 출시일 | 리뷰 |', '|---|---|---|---|---|', ...added.map((a) => `| ${a.name.replace(/\|/g, '/')} | ${a.appid} | ${a.kind === 'upcoming' ? '출시 예정' : '출시작'} | ${a.release} | ${a.kind === 'upcoming' ? '-' : a.reviews} |`));
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join('\n') + '\n');
}

main().catch((e) => { console.error(e); process.exit(1); });
