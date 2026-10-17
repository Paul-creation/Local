// scripts/bulk-import.mjs
// 스팀 새 게임 수집 — 한국 최고 판매 순위에서 새 게임을 찾아 넣음 (매주 갱신 첫 단계)
// 실행: node --env-file=.env.local scripts/bulk-import.mjs                                       (미리보기 — 넣을 게임만 출력, DB는 안 건드림. --dry-run을 붙여도 같음)
//       node --env-file=.env.local scripts/bulk-import.mjs --apply                               (판매 순위에서 새 게임 최대 200개 추가 — 매주 갱신이 쓰는 방식)
//       node --env-file=.env.local scripts/bulk-import.mjs --appids data/meta/must-have.json         (꼭 넣을 게임 목록만 미리보기)
//       node --env-file=.env.local scripts/bulk-import.mjs --appids data/meta/must-have.json --apply (꼭 넣을 게임 목록만 추가)
// - 기준(두 방식 같음): 이미 있는 게임·판매 중단 목록 제외, 스팀 종류가 game, 성인·프로그램 장르 제외, 리뷰 1,000개 이상·긍정 65% 이상
//   --appids는 손으로 고른 목록이라 긍정 60% 이상까지 받음 (판매 순위 수집은 65% 그대로)
//   판매 순위 수집만 2013년 이후 출시 조건 추가 (--appids는 손으로 고른 목록이라 연도 무관). 단 리뷰 10,000개 이상이면 그 전 출시도 통과
//   판정은 scripts/lib/catalog-rules.mjs (테스트 있음)
// - 후보에 스팀 공식 동접 차트 상위 100도 더함 (판매 순위보다 먼저). 차트의 현재 동접이 5,000 이상이면 긍정률·연도 조건 면제 (리뷰 1,000개·종류·장르는 그대로)
// - --appids 목록 항목에 "force": true를 쓰면 그 게임만 긍정률·연도 조건 면제
// - 한국 상점에 없는 게임은 무료일 때만 미국 상점(cc=us) 정보로 대신 넣음 (가격 기록 없음 = 무료). 유료는 예전처럼 제외
// - --dry-run(또는 --apply 없이): 이번 변경 덕에 새로 들어오는 게임(이름·동접·긍정률·출시연도·통과 이유)을 따로 정리해 출력. DB 쓰기 없음
// - 크로스플레이(스팀 카테고리 27)는 넣을 때 has_crossplay로 같이 저장
// - 스팀 요청은 scripts/lib/steam.mjs(요청 간격 + 429 재시도)로 함. 끝까지 실패한 게임은 건너뛰고 마지막에 목록으로 출력
// - --appids 파일: [{ "steam_appid": "1145350", "force": true }] 형식의 JSON (name·reason 칸은 출력용, force는 생략 가능)
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { isNonGame } from './lib/non-game.mjs';
import { steamGet, appdetailsUrl } from './lib/steam.mjs';
import { judge, parseChart } from './lib/catalog-rules.mjs';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const APPLY = process.argv.includes('--apply');
const DRY_RUN = process.argv.includes('--dry-run');
if (APPLY && DRY_RUN) { console.error('--apply와 --dry-run은 같이 쓸 수 없어요'); process.exit(1); }
const APPIDS_FILE = process.argv.includes('--appids') ? process.argv[process.argv.indexOf('--appids') + 1] : null;

const REVIEW_LABELS = {
  'Overwhelmingly Positive': '압도적으로 긍정적', 'Very Positive': '매우 긍정적',
  'Positive': '긍정적', 'Mostly Positive': '대체로 긍정적', 'Mixed': '복합적',
  'Mostly Negative': '대체로 부정적', 'Negative': '부정적',
  'Very Negative': '매우 부정적', 'Overwhelmingly Negative': '압도적으로 부정적',
  'No user reviews': '리뷰 없음',
};

const MAX_NEW_GAMES = 200;
const TIME_BUDGET_MS = 40 * 60 * 1000; // run-steps 단계 시간 제한(45분) 전에 스스로 멈춤
const CHART_URL = 'https://api.steampowered.com/ISteamChartsService/GetGamesByConcurrentPlayers/v1/';

const startedAt = Date.now();
const failed = []; // 스팀 요청이 끝까지 실패한 게임 { appid, name, reason }
const skipped = []; // 기준에 안 맞아 뺀 게임 (--appids일 때만 모아서 출력)
let chartCcu = new Map(); // 스팀 공식 동접 차트 appid → 현재 동접

async function getKoreanTopSellers(page) {
  try {
    const json = await steamGet(`https://store.steampowered.com/search/results?filter=topsellers&cc=kr&l=korean&json=1&start=${page * 50}&count=50`);
    return (json.items || []).map((item) => {
      // logo 주소에서 appid 추출 (예: /steam/apps/578080/...). 번들·패키지는 /apps/가 없어서 빠짐
      const match = item.logo?.match(/\/apps\/(\d+)\//);
      return match ? { appid: match[1], name: item.name } : null;
    }).filter(Boolean);
  } catch (e) {
    console.log(`⚠️  판매 순위 ${page + 1}페이지를 못 받음 — ${e.message}`);
    return null;
  }
}

// 스팀 공식 동접 차트 상위 100 (키 불필요). 못 받으면 빈 목록으로 두고 판매 순위만 씀
async function getChart() {
  try {
    return parseChart(await steamGet(CHART_URL));
  } catch (e) {
    console.log(`⚠️  동접 차트를 못 받음 — ${e.message} (판매 순위 후보만 사용)`);
    return new Map();
  }
}

function readAppidsFile(file) {
  const list = JSON.parse(readFileSync(file, 'utf8'));
  if (!Array.isArray(list)) throw new Error(`${file}: 배열이 아니에요`);
  return list
    .map((x) => ({ appid: String(x.steam_appid ?? x.appid ?? '').trim(), name: x.name || '', force: x.force === true }))
    .filter((x) => /^\d+$/.test(x.appid));
}

// 한 게임을 기준에 맞춰 확인 → { data, year, reviewSummary, via, legacyOk, positive, ccu } 또는 null (뺀 이유는 skipped·failed에 기록)
async function check(item) {
  const { appid } = item;
  const skip = (reason) => { skipped.push({ ...item, reason }); return null; };
  try {
    // 영어로 출시일·장르·종류 확인 (한국어 응답은 장르 이름도 한국어라 영어 기준 비교가 안 됨)
    let cc = 'kr';
    let en = (await steamGet(appdetailsUrl(appid, 'english', cc)))?.[appid];
    if (!en?.success) {
      // 한국 상점에 없는 게임(현지 퍼블리셔 서비스 등)은 무료일 때만 미국 상점 정보로 대신함
      const us = (await steamGet(appdetailsUrl(appid, 'english', 'us')))?.[appid];
      if (!us?.success) return skip('스팀 상점 정보 없음 (판매 중단·지역 제한일 수 있음)');
      if (!us.data.is_free) return skip('한국 상점 정보 없음 (유료라 제외)');
      cc = 'us';
      en = us;
    }
    const enData = en.data;
    const year = new Date(enData.release_date?.date || '').getFullYear();
    const enGenres = (enData.genres || []).map((g) => g.description);
    const type = enData.type;

    // 종류·장르에서 이미 탈락이면 리뷰 요청은 아낌
    const enCategories = (enData.categories || []).map((c) => c.description);
    const pre = judge({ type, year, genres: enGenres, reviews: 1e9, positive: 1, name: enData.name, categories: enCategories }, { fromList: !!APPIDS_FILE });
    if (!pre.ok) return skip(pre.reason);

    const reviews = await steamGet(`https://store.steampowered.com/appreviews/${appid}?json=1&filter=summary&language=all&purchase_type=all`);
    const qs = reviews?.query_summary;
    if (!qs || !qs.total_reviews) return skip('리뷰 정보 없음');
    const positive = qs.total_positive / qs.total_reviews;
    const info = { type, year, genres: enGenres, reviews: qs.total_reviews, positive, name: enData.name, categories: enCategories };
    const ccu = chartCcu.get(appid) || 0;
    const verdict = judge(info, { fromList: !!APPIDS_FILE, force: item.force, ccu });
    if (!verdict.ok) return skip(verdict.reason);
    const legacyOk = judge(info, { fromList: !!APPIDS_FILE, legacy: true }).ok; // 이번 변경 전 기준으로도 들어왔을까

    const ko = (await steamGet(appdetailsUrl(appid, 'korean', cc)))?.[appid];
    if (!ko?.success) return skip(cc === 'kr' ? '한국 상점 정보 없음' : '미국 상점 한국어 정보 없음');
    return { data: ko.data, year: isNaN(year) ? null : year, reviewSummary: REVIEW_LABELS[qs.review_score_desc] || null, via: verdict.via, legacyOk, positive, ccu, usFallback: cc === 'us' };
  } catch (e) {
    failed.push({ ...item, reason: e.message });
    return null;
  }
}

async function insert(appid, { data, reviewSummary }) {
  const row = {
    name: data.name,
    steam_appid: appid,
    platform: ['steam'],
    cover_image_url: data.header_image,
    description: data.short_description,
    review_summary: reviewSummary,
    is_casual_party: false,
    ...(data.is_free ? { is_free: true } : {}),
    // 스팀 성인 콘텐츠 표기 (없으면 빈 배열 = 확인함). 예전 게임은 fill-content-descriptors.mjs
    content_descriptor_ids: [...new Set((data.content_descriptors?.ids || []).map(Number))].sort((a, b) => a - b),
    // 크로스플레이 — 스팀 카테고리 27 "Cross-Platform Multiplayer". 카테고리가 없으면 모름(null). 예전 게임은 fill-crossplay.mjs
    has_crossplay: data.categories?.length ? data.categories.some((c) => Number(c.id) === 27) : null,
  };
  let { data: inserted, error } = await supabase.from('games').insert(row).select().single();
  // 마이그레이션(20261014090000_launch_extras.sql) 전이라 has_crossplay 칸이 없으면 그 칸만 빼고 다시 넣음
  if (error && /has_crossplay/.test(error.message)) {
    const rest = { ...row };
    delete rest.has_crossplay;
    ({ data: inserted, error } = await supabase.from('games').insert(rest).select().single());
  }
  if (error) {
    failed.push({ appid, name: data.name, reason: `저장 실패: ${error.message}` });
    return false;
  }
  if (!data.is_free && data.price_overview) {
    await supabase.from('price_history').insert({
      game_id: inserted.id,
      price: data.price_overview.final / 100,
      discount_percent: data.price_overview.discount_percent,
      original_price: data.price_overview.initial / 100 >= 100 ? data.price_overview.initial / 100 : null, // 스팀 정가
    });
  }
  return true;
}

async function main() {
  const { data: existing, error } = await supabase.from('games').select('steam_appid');
  if (error) return console.error('게임 목록 조회 실패:', error.message);
  const existingAppids = new Set((existing || []).map((g) => String(g.steam_appid)));
  const { data: delisted } = await supabase.from('delisted_appids').select('steam_appid');
  const delistedAppids = new Set((delisted || []).map((d) => String(d.steam_appid)));

  console.log(`${APPLY ? '반영' : '미리보기'} — ${APPIDS_FILE ? `${APPIDS_FILE}의 게임만` : `한국 최고 판매 순위에서 새 게임 최대 ${MAX_NEW_GAMES}개`}\n`);

  const added = [];
  const already = [];
  const seen = new Set(); // 차트와 판매 순위에 같은 게임이 둘 다 있어도 한 번만 확인
  let stoppedByTime = false;

  const handle = async (item) => {
    if (seen.has(item.appid)) return;
    seen.add(item.appid);
    if (existingAppids.has(item.appid)) { already.push(item); return; }
    if (delistedAppids.has(item.appid)) { skipped.push({ ...item, reason: '판매 중단 목록(delisted_appids)에 있음' }); return; }
    const ok = await check(item);
    if (!ok) return;
    if (APPLY && !(await insert(item.appid, ok))) return;
    existingAppids.add(item.appid);
    added.push({ appid: item.appid, name: ok.data.name, year: ok.year, positive: ok.positive, ccu: ok.ccu, via: ok.via, legacyOk: ok.legacyOk, usFallback: ok.usFallback });
    console.log(`${APPLY ? '✅ 추가됨' : '➕ 추가 예정'}: ${ok.data.name} (${item.appid}) — ${ok.year ?? '출시일 모름'} · ${ok.via}${ok.usFallback ? ' · 미국 상점 정보(무료)' : ''}`);
  };

  if (APPIDS_FILE) {
    chartCcu = await getChart(); // 목록 게임이 차트에 있으면 같은 인기 예외를 받음
    for (const item of readAppidsFile(APPIDS_FILE)) {
      if (Date.now() - startedAt > TIME_BUDGET_MS) { stoppedByTime = true; break; }
      await handle(item);
    }
  } else {
    chartCcu = await getChart();
    console.log(`동접 차트 후보 ${chartCcu.size}개`);
    for (const [appid] of [...chartCcu].sort((a, b) => b[1] - a[1])) {
      if (added.length >= MAX_NEW_GAMES) break;
      if (Date.now() - startedAt > TIME_BUDGET_MS) { stoppedByTime = true; break; }
      await handle({ appid, name: '' });
    }
    for (let page = 0; !stoppedByTime && added.length < MAX_NEW_GAMES; page++) {
      const items = await getKoreanTopSellers(page);
      if (!items?.length) break;
      console.log(`페이지 ${page + 1}: ${items.length}개 후보`);
      for (const item of items) {
        if (added.length >= MAX_NEW_GAMES) break;
        if (Date.now() - startedAt > TIME_BUDGET_MS) { stoppedByTime = true; break; }
        await handle(item);
      }
    }
  }

  console.log(`\n${APPLY ? '추가' : '추가 예정'} ${added.length}개`);
  if (APPIDS_FILE) {
    if (already.length) console.log(`이미 있음 ${already.length}개: ${already.map((x) => x.name || x.appid).join(', ')}`);
    if (skipped.length) {
      console.log(`\n기준에 안 맞아 뺀 게임 ${skipped.length}개:`);
      for (const s of skipped) console.log(`   ⏭️  ${s.name || s.appid} (${s.appid}) — ${s.reason}`);
    }
  }
  if (!APPLY) {
    const fresh = added.filter((x) => !x.legacyOk);
    console.log(`\n이번 변경(인기 예외·연도 완화·force·무료 폴백) 덕에 새로 들어오는 게임 ${fresh.length}개 (예전 기준으로도 들어오는 게임은 ${added.length - fresh.length}개):`);
    for (const x of fresh) {
      console.log(`   ➕ ${x.name} (${x.appid}) | 동접 ${x.ccu ? x.ccu.toLocaleString('ko-KR') : '-'} | 긍정 ${Math.round(x.positive * 100)}% | ${x.year ?? '출시일 모름'}년 | ${x.via}${x.usFallback ? ' | 미국 상점 정보(무료)' : ''}`);
    }
  }
  if (failed.length) {
    console.log(`\n스팀 요청·저장이 실패해서 건너뛴 게임 ${failed.length}개 (다음 실행 때 다시 시도됨):`);
    for (const f of failed) console.log(`   ❌ ${f.name || f.appid} (${f.appid}) — ${f.reason}`);
  }
  if (stoppedByTime) console.log(`\n⏱️  ${TIME_BUDGET_MS / 60000}분이 지나서 여기서 멈춤 (남은 후보는 다음 실행 때 처리)`);
  if (!APPLY) console.log(`\n${DRY_RUN ? '--dry-run이라 DB는 안 건드렸어요.' : '미리보기만 했어요.'} 반영하려면 --apply를 붙여 주세요`);
}

main().catch((e) => {
  console.error('수집 중단:', e.message);
  process.exit(1);
});
