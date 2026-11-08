// scripts/find-new-coop-games.mjs
// 주간 스팀 협동 신작 후보 찾기 — 지금은 미리보기만 (DB 쓰기 없음, --apply 없음). 승인 뒤 weekly에 연결 예정
// 실행: node --env-file=.env.local scripts/find-new-coop-games.mjs
// 후보 출처 (키 불필요, 요청 간격은 steam.mjs 2초 / GetItems는 100개씩 묶음이라 요청 몇 번)
//   출시작: 스팀 검색(카테고리 멀티·협동·온라인 협동·온라인 PvP를 하나씩 검색해 합침, 출시일 내림차순) → 14일 지난 게시물이 나올 때까지
//   출시 예정: 스팀 검색 "인기 출시 예정" 정렬 상위 (팔로워 수는 로그인 없이 못 받아 이 순위로 대신함)
//   종류·카테고리·출시일·리뷰: IStoreBrowseService/GetItems (100개씩) / 동접: GetNumberOfCurrentPlayers (리뷰 20개 미만만) / 성인·장르: appdetails (통과 후보만)
// 기준은 scripts/lib/new-coop-rules.mjs
import { createClient } from '@supabase/supabase-js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { steamGet, appdetailsUrl } from './lib/steam.mjs';
import { normalizeItem, firstPass, releasedQuality, secondPass, rankPassed, WINDOW_DAYS, WEEKLY_MAX, UPCOMING_TOP_RANK } from './lib/new-coop-rules.mjs';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const nowTs = Math.floor(Date.now() / 1000);
const SEARCH = 'https://store.steampowered.com/search/results?json=1&cc=kr&l=english&category1=998';
const SEARCH_CATEGORIES = [1, 9, 38, 36]; // 멀티플레이어·협동·온라인 협동·온라인 PvP — category3에 쉼표로 여럿 주면 AND라서 하나씩 검색해 합침
const getItemsUrl = (appids) => `https://api.steampowered.com/IStoreBrowseService/GetItems/v1/?input_json=${encodeURIComponent(JSON.stringify({ ids: appids.map((a) => ({ appid: Number(a) })), context: { language: 'english', country_code: 'KR' }, data_request: { include_reviews: true, include_release: true } }))}`;
const MAX_RELEASED_PAGES = 8; // 100개씩 — 14일치는 보통 2~3페이지
const UPCOMING_PAGES = 1; // 인기 출시 예정 상위 100
const NEAR_MISS_DAYS = 28; // 아까운 후보: 이 기간 안 출시인데 14일만 넘긴 것
const fmtDate = (ts) => (ts ? new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date(ts * 1000)) : '-');
const appidOf = (x) => x.logo?.match(/\/apps\/(\d+)\//)?.[1];

async function searchPage(extra, start, cat) {
  const json = await steamGet(`${SEARCH}&category3=${cat}&${extra}&start=${start}&count=100`);
  return (json.items || []).map((x) => ({ appid: appidOf(x), name: x.name })).filter((x) => x.appid);
}
async function getItems(appids) {
  const out = new Map();
  for (let i = 0; i < appids.length; i += 100) {
    const json = await steamGet(getItemsUrl(appids.slice(i, i + 100)), { gapMs: 1000 });
    for (const it of json?.response?.store_items ?? []) {
      const c = normalizeItem(it);
      out.set(c.appid, c);
    }
  }
  return out;
}
async function currentPlayers(appid) {
  try {
    const j = await steamGet(`https://api.steampowered.com/ISteamUserStats/GetNumberOfCurrentPlayers/v1/?appid=${appid}`, { waits: [] });
    return j?.response?.result === 1 ? j.response.player_count : null;
  } catch { return null; }
}

async function main() {
  console.log(`미리보기(DB 쓰기 없음) — 최근 ${WINDOW_DAYS}일 협동 신작 + 인기 출시 예정 상위 ${UPCOMING_TOP_RANK}위\n`);
  const { data: existing, error } = await supabase.from('games').select('steam_appid'); // hidden 포함
  if (error) throw new Error(`games 조회 실패: ${error.message}`);
  const have = new Set((existing || []).map((g) => String(g.steam_appid)));
  const { data: del } = await supabase.from('delisted_appids').select('steam_appid');
  const delisted = new Set((del || []).map((d) => String(d.steam_appid)));

  // 1) 후보 모으기
  const released = new Map(); // appid → name
  for (const cat of SEARCH_CATEGORIES) {
    let oldestAge = 0;
    for (let p = 0; p < MAX_RELEASED_PAGES && oldestAge <= NEAR_MISS_DAYS; p++) {
      const page = await searchPage('sort_by=Released_DESC', p * 100, cat);
      if (!page.length) break;
      const fresh = page.filter((x) => !cache.has(x.appid));
      for (const [k, v] of await getItems(fresh.map((x) => x.appid))) cache.set(k, v);
      for (const x of page) released.set(x.appid, x.name);
      const ts = page.map((x) => cache.get(x.appid)?.releaseTs).filter(Boolean);
      oldestAge = ts.length ? (nowTs - Math.min(...ts)) / 86400 : 999;
    }
  }
  const rankOf = new Map(); // 카테고리별 인기 출시 예정 목록에서의 순위 중 가장 높은 것
  for (const cat of SEARCH_CATEGORIES) {
    for (let p = 0; p < UPCOMING_PAGES; p++) {
      const page = await searchPage('filter=popularcomingsoon', p * 100, cat);
      page.forEach((x, i) => { const r = p * 100 + i + 1; if (!rankOf.has(x.appid) || r < rankOf.get(x.appid)) rankOf.set(x.appid, r); });
      for (const [k, v] of await getItems(page.map((x) => x.appid).filter((a) => !cache.has(a)))) cache.set(k, v);
    }
  }
  const all = new Set([...released.keys(), ...rankOf.keys()]);
  console.log(`후보 ${all.size}개 (출시일순 ${released.size}, 출시 예정 인기순 ${rankOf.size}, 겹치면 한 번만 셈)\n`);

  // 2) 1차 판정 (GetItems 값만)
  const rows = []; // { c, kind, rank, ccu, status: 'pass'|'drop'|'near', reason }
  for (const appid of all) {
    const c = cache.get(appid);
    if (!c) { rows.push({ c: { appid, name: released.get(appid) || '' , categories: [], reviews: 0 }, status: 'drop', reason: '스팀 상세 응답 없음' }); continue; }
    const row = { c, rank: rankOf.get(appid) ?? null, ccu: null };
    if (delisted.has(appid)) { rows.push({ ...row, status: 'skip-have', reason: '판매 중단 목록(delisted_appids)' }); continue; }
    if (have.has(appid)) { rows.push({ ...row, status: 'skip-have', reason: '이미 games에 있음' }); continue; }
    const fp = firstPass(c, { nowTs, rank: row.rank });
    if (fp.drop) {
      const age = c.releaseTs ? (nowTs - c.releaseTs) / 86400 : 999;
      const near = !c.comingSoon && c.type === 0 && c.categories.length && age > WINDOW_DAYS && age <= NEAR_MISS_DAYS && c.reviews >= 100;
      rows.push({ ...row, status: near ? 'near' : 'drop', reason: fp.reason });
      continue;
    }
    rows.push({ ...row, kind: fp.kind, status: 'cand', reason: '' });
  }

  // 3) 출시작 품질 (동접은 리뷰 5~19개만 조회 — 리뷰 5개 미만은 동접 100명이 나온 적이 없어 요청을 아낌)
  for (const r of rows.filter((x) => x.kind === 'released')) {
    if (r.c.reviews >= 5 && r.c.reviews < 20) r.ccu = await currentPlayers(r.c.appid);
    const q = releasedQuality(r.c, r.ccu);
    r.quality = q.why;
    if (!q.ok) {
      const near = r.c.reviews >= 5 || (r.ccu ?? 0) >= 50;
      r.status = near ? 'near' : 'drop';
      r.reason = `품질 기준 미달 (${q.why})`;
    }
  }

  // 4) 2차 판정 (appdetails) — 통과 후보만
  for (const r of rows.filter((x) => x.status === 'cand')) {
    try {
      const res = (await steamGet(appdetailsUrl(r.c.appid, 'english', 'kr')))?.[r.c.appid];
      if (!res?.success) { r.status = 'drop'; r.reason = '스팀 상점 정보 없음 (지역 제한 등)'; continue; }
      const sp = secondPass(res.data);
      if (!sp.ok) { r.status = 'drop'; r.reason = sp.reason; continue; }
      r.releaseText = res.data.release_date?.date || '';
      r.status = 'pass';
      r.reason = r.kind === 'upcoming' ? `인기 출시 예정 ${r.rank}위` : r.quality;
    } catch (e) { r.status = 'drop'; r.reason = `확인 실패: ${e.message}`; }
  }

  // 5) 출력
  const passed = rows.filter((r) => r.status === 'pass').map((r) => ({ ...r, kind: r.kind, reviews: r.c.reviews, ccu: r.ccu }));
  const top = rankPassed(passed, WEEKLY_MAX);
  const topIds = new Set(top.map((r) => r.c.appid));
  const cell = (s) => String(s ?? '').replace(/\|/g, '/');
  const line = (r) => `| ${cell(r.c.name)} | ${r.c.appid} | ${r.c.comingSoon ? `출시 예정 ${fmtDate(r.c.releaseTs)}` : `출시 ${fmtDate(r.c.releaseTs)}`} | ${r.c.categories.join(', ') || '-'} | ${r.c.comingSoon ? `인기순위 ${r.rank ?? '-'}` : `리뷰 ${r.c.reviews}${r.ccu != null ? ` · 동접 ${r.ccu}` : ''}`} | ${r.status === 'pass' ? (topIds.has(r.c.appid) ? '통과 ✅' : '통과 (주 30개 초과)') : r.reason} |`;
  const head = '| 이름 | appid | 출시일·상태 | 협동 카테고리 | 리뷰/동접/순위 | 통과/탈락 이유 |\n|---|---|---|---|---|---|';
  console.log(`## 통과 ${passed.length}개 (이번 주 추가 대상 ${top.length}개)\n${head}`);
  for (const r of top) console.log(line(r));
  const over = passed.filter((r) => !topIds.has(r.c.appid));
  if (over.length) { console.log(`\n### 통과했지만 주 ${WEEKLY_MAX}개 초과로 밀린 것 ${over.length}개\n${head}`); for (const r of over) console.log(line(r)); }
  const near = rows.filter((r) => r.status === 'near');
  console.log(`\n## 아까운 탈락 ${near.length}개\n${head}`);
  for (const r of near.sort((a, b) => b.c.reviews - a.c.reviews).slice(0, 15)) console.log(line(r));
  const count = (f) => rows.filter(f).length;
  console.log(`\n## 요약\n- 이미 games에 있음(hidden·판매 중단 포함) ${count((r) => r.status === 'skip-have')}개`);
  const reasons = new Map();
  for (const r of rows.filter((x) => x.status === 'drop' || x.status === 'near')) { const k = r.reason.replace(/\d+/g, 'N').replace(/\(.*\)/, '').trim(); reasons.set(k, (reasons.get(k) || 0) + 1); }
  for (const [k, n] of [...reasons].sort((a, b) => b[1] - a[1])) console.log(`- 탈락: ${k} ${n}개`);
  mkdirSync('scripts/.cache', { recursive: true });
  writeFileSync('scripts/.cache/new-coop-preview.json', JSON.stringify({ at: new Date().toISOString(), rows }, null, 1));
  console.log('\nDB는 안 건드렸어요. (상세는 scripts/.cache/new-coop-preview.json)');
}

const cache = new Map();
main().catch((e) => { console.error(e); process.exit(1); });
