// scripts/fill-activities-v2.mjs
// "가능한 활동" v2 채우기 — 분류표 키(app/lib/activities.ts)마다 yes/no/unknown + 근거를 Message Batches API로 받아 저장
// - 입력: 스팀 영어 상점 설명 전체 + 사용자 태그(득표 수) + 카테고리·장르 + 사이트 description (웹 검색 없음)
// - 저장 규칙: input+strong(입력에서 그대로 인용) → activities_confirmed, knowledge+strong → activities_unsure("확인 중"으로 노출 예정),
//   weak(근거가 그 키를 직접 뒷받침하지 않음) → 어디에도 넣지 않고 activities_evidence에만 기록
// - 기존 games.activities는 건드리지 않음. activities_ai_at이 있는 게임은 --apply에서 다시 처리하지 않음
// 사용:
//   node --env-file=.env.local scripts/fill-activities-v2.mjs --dry-run --ids data/meta/activities-v2-pilot.json   (추정 비용만 출력)
//   ... --dry-run --ids ... --yes     (배치 실행, DB 쓰기 없이 scripts/.cache/에 결과 파일)
//   ... --apply [--ids 파일] [--limit N] --yes   (배치 실행 + DB 저장. 마이그레이션 20261021090000 적용 뒤)
//   ... --collect <배치 id> --dry-run|--apply    (이미 제출한 배치의 결과만 받아 처리)
// 스크립트라서 api.anthropic.com을 직접 부름 (aiGuard 예외 대상)
import { createClient } from '@supabase/supabase-js';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { ACTIVITIES } from '../app/lib/activities.ts';
import { onlyIds } from './lib/only-ids.mjs';
import { steamGet, appdetailsUrl } from './lib/steam.mjs';
import { fetchSteamTags } from './lib/steam-tags.mjs';
import { classify, parseJson } from './lib/activities-classify.mjs';

// 모델·가격 출처: Anthropic 가격표 https://platform.claude.com/docs/en/about-claude/pricing (2026-10-15 확인)
// Sonnet 5.5 $2 입력 / $10 출력 per MTok, 배치 50% 할인 → $1 / $5, 캐시 쓰기(5분) 2.5×0.5, 캐시 읽기 0.1×0.5
const DEFAULT_MODEL = 'claude-sonnet-5-5';
const PRICE = { input: 1, cacheWrite: 1.25, cacheRead: 0.05, output: 5 }; // 배치 기준 $/MTok
const EFFORT = 'medium';
const MAX_TOKENS = 4000; // 생각 토큰 포함 상한
const API = 'https://api.anthropic.com/v1/messages/batches';
const CACHE_DIR = 'scripts/.cache';
const INPUT_CACHE = `${CACHE_DIR}/activities-v2-input.json`;
const DESC_MAX = 6000;

const argv = process.argv.slice(2);
const flag = (n) => argv.includes(n);
const arg = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null; };
const DRY = flag('--dry-run');
const APPLY = flag('--apply');
const YES = flag('--yes');
const LIMIT = arg('--limit') ? Number(arg('--limit')) : null;
const COLLECT = arg('--collect');
const MODEL = arg('--model') || DEFAULT_MODEL;

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const readJson = (p, fallback) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : fallback);
const writeJson = (p, v) => { mkdirSync(CACHE_DIR, { recursive: true }); writeFileSync(p, JSON.stringify(v, null, 1) + '\n'); };

// ---------- 프롬프트 ----------
const SYSTEM = `너는 게임이 "어떤 활동을 직접 할 수 있게 해 주는지"를 입력 자료를 우선 근거로 판정하는 분류기다. 한국 사이트에서 친구와 할 게임을 고르는 데 쓰인다.

[활동 키 목록] key | 라벨 | 정의 | 체크 기준
${ACTIVITIES.map((a) => `${a.key} | ${a.label} | ${a.def} | ${a.check}`).join('\n')}

[판정 규칙]
- 각 키마다 yes / no / unknown 중 하나를 고른다. 모든 키를 빠짐없이 답한다.
- yes: 플레이어가 그 행동을 직접 할 수 있다고 판단될 때만. 모드(mod)나 DLC에서만 가능한 것, 이름·시리즈만 보고 짐작한 것은 yes가 아니다.
- yes의 근거 basis는 둘 중 하나다.
  · "input": 입력 자료(설명·태그·카테고리·장르)에 직접 드러남. 이때 quote에 입력에서 글자 그대로 복사한 문구(영어 원문 그대로, 120자 이내)를 적는다. 요약·번역·바꿔 쓰기 금지.
  · "knowledge": 입력에는 없지만 널리 알려진 사실로 확신함. quote는 빈 문자열.
- yes마다 strength를 정한다.
  · "strong": 그 quote(또는 확신하는 지식)가 이 키의 체크 기준을 직접 뒷받침한다.
  · "weak": 인용이 그 키를 직접 뒷받침하지 않거나(분위기·일반 소개 문장, 여러 키에 같은 문장을 돌려 씀), 간접 추정이거나, 체크 기준에 못 미친다(있기는 하나 중심이 아님 등). 확신이 없으면 weak다.
  · 예: 위쳐 3의 hunt에 "journey across a dark fantasy open world"를 인용하면 사냥을 말하지 않으므로 weak. Palworld의 sail에 "Pals can be mounted to traverse the land, sea and sky"를 인용하면 배를 조종한다는 말이 없으므로 weak.
  · 한 문장을 여러 키의 근거로 쓸 때는 키마다 그 문장이 그 키를 직접 말하는지 따로 판단한다.
- 입력에 언급이 없어도 그 게임의 널리 알려진 기능이라 확신하면 basis "knowledge", strength "strong"으로 yes다. 입력에 없다는 이유만으로 unknown으로 두지 않는다. 그런 기능이 있는지 정말 모르거나 기억이 불분명할 때만 unknown, 있기는 하나 부수적이면 weak다.
- 스팀 카테고리 칸의 문구(예: Online PvP, Steam Workshop, Includes level editor)만 인용한 근거는 약한 근거다. 설명이나 태그에 같은 내용이 없으면 weak로 한다. 특히 pvp는 설명·태그에 플레이어 간 대전 내용이 있어야 strong이다.
- mod_edit: 게임이 에디터·제작 도구를 직접 제공한다는 문구가 있을 때만 yes다. 모드 설치 지원, Steam Workshop 이용, 사용자 모드 언급은 해당하지 않는다(no 또는 unknown).
- boss_raid: 보스전이 전투 콘텐츠로 있을 때만 yes다. 리듬·퍼즐 게임의 연출상 보스 스테이지는 boss_raid가 아니다.
- no: 이 활동이 없다고 확신할 때. 확신이 없으면 unknown.
- 협동·대전·싱글 같은 모드나 장르(스토리, RPG, 로그라이크, 전략)는 활동이 아니므로 고려하지 않는다.
- 탈것이 나와도 플레이어가 직접 조작하지 않으면 drive/fly/ride/sail/train은 no 또는 unknown.

[출력] JSON 한 덩어리만. 코드블록·설명 금지.
{"v":{"<key>":"yes|no|unknown", ...모든 키},"e":{"<yes인 key>":{"basis":"input|knowledge","strength":"strong|weak","quote":"...","note":"한국어 한 줄 40자 이내"}}}`;

const stripHtml = (s) => String(s || '')
  .replace(/<img[^>]*>/gi, ' ').replace(/<br\s*\/?>|<\/p>|<\/li>|<\/h\d>/gi, '\n').replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
  .replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();

function userText(g, inp) {
  const tags = (inp.tags || []).slice().sort((a, b) => b.votes - a.votes).slice(0, 20).map((t) => `${t.en} (${t.votes})`).join(', ');
  return [
    `게임: ${g.name} (Steam ${g.steam_appid})`,
    `[스팀 카테고리] ${(inp.categories || []).join(', ') || '(없음)'}`,
    `[장르] ${(inp.genres || []).join(', ') || '(없음)'}`,
    `[사용자 태그 (득표 수)] ${tags || '(없음)'}`,
    `[짧은 설명] ${inp.short || '(없음)'}`,
    `[상점 설명 전체]\n${inp.desc || '(없음)'}`,
    `[사이트 설명(한국어)] ${String(g.description || '').replace(/\s+/g, ' ') || '(없음)'}`,
  ].join('\n');
}

// ---------- 입력 모으기 (스팀 appdetails 영어 + 태그, 받은 건 캐시) ----------
const localTags = (() => {
  const j = readJson('data/tags/game-steam-tags.json', null);
  return new Map(Object.values(j?.games || {}).filter((g) => g.steam_appid && g.tags?.length).map((g) => [String(g.steam_appid), g.tags.map((t) => ({ en: t.en, votes: t.votes }))]));
})();

async function collectInput(g, cache) {
  const appid = String(g.steam_appid);
  if (cache[appid]) return cache[appid];
  const inp = { fetched_at: new Date().toISOString() };
  const body = await steamGet(appdetailsUrl(appid, 'english'), { retryIf: (b) => !b?.[appid] });
  const d = body[appid]?.success ? body[appid].data : null;
  if (d) {
    inp.desc = stripHtml(d.detailed_description || d.about_the_game).slice(0, DESC_MAX);
    inp.short = stripHtml(d.short_description);
    inp.categories = (d.categories || []).map((c) => c.description);
    inp.genres = (d.genres || []).map((c) => c.description);
  } else inp.missing = 'appdetails 없음(지역 제한·판매 중단 등)';
  if (localTags.has(appid)) inp.tags = localTags.get(appid);
  else {
    try { inp.tags = (await fetchSteamTags(appid)).map((t) => ({ en: t.en, votes: t.votes })); } catch (e) { inp.tags = []; inp.tags_error = e.message; }
  }
  cache[appid] = inp;
  return inp;
}

// ---------- 비용 추정 ----------
// 글자 수 → 토큰 어림값(estTokens)에 2026-10-15 시험 30개 실측 보정을 곱함: 시스템 약 2,800토큰(어림 1,684), 사용자 평균 약 1,300토큰(어림 852)
// 출력·생각은 실측 평균 약 650토큰 → 500~1,000토큰으로 가정 (strength 칸이 늘어난 뒤 실측으로 다시 맞출 것)
const CAL = { system: 2800 / 1684, user: 1300 / 852 };
const OUT_TOKENS = [500, 1000];
const estTokens = (s) => { let a = 0, k = 0; for (const ch of s) { if (ch.charCodeAt(0) < 128) a++; else k++; } return Math.ceil(a / 4 + k / 1.2); };
function estimate(texts) {
  const sys = Math.round(estTokens(SYSTEM) * CAL.system);
  const user = Math.round(texts.reduce((n, t) => n + estTokens(t), 0) * CAL.user);
  const n = texts.length;
  const cost = (outPer, cached) => {
    const sysCost = cached ? (sys * PRICE.cacheWrite + (n - 1) * sys * PRICE.cacheRead) : n * sys * PRICE.input;
    return (sysCost + user * PRICE.input + n * outPer * PRICE.output) / 1e6;
  };
  return { n, sys, userAvg: Math.round(user / Math.max(n, 1)), low: cost(OUT_TOKENS[0], true), high: cost(OUT_TOKENS[1], false) };
}

// ---------- 배치 API ----------
const headers = () => ({ 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' });
async function api(url, init) {
  const res = await fetch(url, { ...init, headers: headers() });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res;
}

async function submit(items) {
  const requests = items.map(({ g, text }) => ({
    custom_id: g.id,
    params: {
      model: MODEL,
      max_tokens: MAX_TOKENS,
      output_config: { effort: EFFORT },
      system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: text }],
    },
  }));
  const res = await api(API, { method: 'POST', body: JSON.stringify({ requests }) });
  return res.json();
}

async function waitEnded(id) {
  for (;;) {
    let b;
    try { b = await (await api(`${API}/${id}`)).json(); } catch (e) { console.log(`   ⏳ 상태 조회 실패, 다시 시도: ${e.message}`); await sleep(60000); continue; }
    const c = b.request_counts;
    console.log(`   배치 ${b.processing_status} — 진행 ${c.processing} / 성공 ${c.succeeded} / 오류 ${c.errored} / 취소 ${c.canceled} / 만료 ${c.expired}`);
    if (b.processing_status === 'ended') return b;
    await sleep(60000);
  }
}

async function results(batch) {
  const text = await (await api(batch.results_url)).text();
  return text.split('\n').filter(Boolean).map((l) => JSON.parse(l));
}

// ---------- 메인 ----------
async function main() {
  if (!DRY && !APPLY) return console.error('--dry-run(DB 쓰기 없이 파일로) 또는 --apply(DB 저장) 중 하나를 지정해 주세요');
  if (DRY && APPLY) return console.error('--dry-run과 --apply는 같이 쓸 수 없어요');
  if (!process.env.ANTHROPIC_API_KEY) return console.error('.env.local에 ANTHROPIC_API_KEY가 없어요');

  const cols = 'id, name, steam_appid, description' + (APPLY ? ', activities_ai_at' : '');
  let q = supabase.from('games').select(cols).eq('hidden', false).not('steam_appid', 'is', null).order('heat_rank', { ascending: true, nullsFirst: false });
  q = onlyIds(q);
  if (APPLY) q = q.is('activities_ai_at', null);
  if (COLLECT) { const meta = readJson(`${CACHE_DIR}/activities-v2-batch-${COLLECT}.json`, null); if (!meta) return console.error('그 배치의 메타 파일이 없어요'); q = q.in('id', meta.ids); }
  const { data, error } = await q;
  if (error) return console.error('조회 실패:', error.message);
  const games = LIMIT ? data.slice(0, LIMIT) : data;
  console.log(`대상 ${games.length}개 (스팀 게임만, 스팀 외 게임은 제외)${APPLY ? ' — 이미 처리한 게임 제외' : ''}\n`);
  if (!games.length) return;

  const cache = readJson(INPUT_CACHE, {});
  const items = [];
  for (const [i, g] of games.entries()) {
    const had = !!cache[g.steam_appid];
    const inp = await collectInput(g, cache).catch((e) => ({ missing: `수집 실패: ${e.message}` }));
    if (!had) { writeJson(INPUT_CACHE, cache); if ((i + 1) % 20 === 0) console.log(`   입력 수집 ${i + 1}/${games.length}`); }
    items.push({ g, inp, text: userText(g, inp) });
  }

  const est = estimate(items.map((x) => x.text));
  console.log(`예상 비용(모델 ${MODEL}, 배치 할인 적용, 추정치): $${est.low.toFixed(2)} ~ $${est.high.toFixed(2)}`);
  console.log(`  (${est.n}개 × 시스템 약 ${est.sys}토큰 + 사용자 평균 약 ${est.userAvg}토큰, 출력·생각 ${OUT_TOKENS[0]}~${OUT_TOKENS[1]}토큰으로 가정. 가격표 2026-10-15 기준)`);

  let batchId = COLLECT;
  if (!COLLECT) {
    if (!YES) return console.log('\n--yes를 붙이면 위 비용으로 배치를 제출해요. 지금은 추정만 하고 끝냅니다.');
    const batch = await submit(items);
    batchId = batch.id;
    writeJson(`${CACHE_DIR}/activities-v2-batch-${batchId}.json`, { batchId, model: MODEL, created_at: new Date().toISOString(), ids: games.map((g) => g.id) });
    console.log(`\n배치 제출: ${batchId} (중간에 끊겨도 --collect ${batchId} 로 이어서 받을 수 있어요)`);
  }
  const ended = await waitEnded(batchId);
  const rows = await results(ended);

  const byId = new Map(items.map((x) => [x.g.id, x]));
  const out = [];
  const usage = { input: 0, cacheWrite: 0, cacheRead: 0, output: 0 };
  for (const r of rows) {
    const it = byId.get(r.custom_id);
    if (!it) continue;
    if (r.result.type !== 'succeeded') { out.push({ id: it.g.id, name: it.g.name, error: r.result.type + (r.result.error?.error?.message ? `: ${r.result.error.error.message}` : '') }); continue; }
    const m = r.result.message;
    const u = m.usage || {};
    usage.input += u.input_tokens || 0; usage.cacheWrite += u.cache_creation_input_tokens || 0; usage.cacheRead += u.cache_read_input_tokens || 0; usage.output += u.output_tokens || 0;
    try {
      if (m.stop_reason === 'refusal' || m.stop_reason === 'max_tokens') throw new Error(`stop_reason ${m.stop_reason}`);
      const parsed = parseJson((m.content || []).filter((b) => b.type === 'text').map((b) => b.text).join(''));
      const c = classify(parsed, it.text, it.inp.categories);
      out.push({ id: it.g.id, name: it.g.name, steam_appid: it.g.steam_appid, input_thin: !!it.inp.missing || !it.inp.desc, ...c });
    } catch (e) { out.push({ id: it.g.id, name: it.g.name, error: e.message }); }
  }

  const cost = (usage.input * PRICE.input + usage.cacheWrite * PRICE.cacheWrite + usage.cacheRead * PRICE.cacheRead + usage.output * PRICE.output) / 1e6;
  const file = `${CACHE_DIR}/activities-v2-${DRY ? 'dryrun' : 'apply'}-${batchId}.json`;
  writeJson(file, { batchId, model: MODEL, usage, cost_usd: Number(cost.toFixed(4)), results: out });

  const label = (k) => ACTIVITIES.find((a) => a.key === k)?.label || k;
  for (const o of out) {
    if (o.error) { console.log(`❌ ${o.name} — ${o.error}`); continue; }
    console.log(`${o.confirmed.length ? '✅' : '➖'} ${o.name}${o.input_thin ? ' (입력 빈약)' : ''}\n     확정: ${o.confirmed.map(label).join(', ') || '-'}\n     확인 필요: ${o.unsure.map(label).join(', ') || '-'}${o.quoteFail ? `   (인용 불일치 ${o.quoteFail}개는 확인 필요로)` : ''}\n     근거 약함(저장 안 함): ${o.weak.map(label).join(', ') || '-'}${o.categoryOnly ? `   (카테고리 문구만 인용 ${o.categoryOnly}개 포함)` : ''}`);
  }
  console.log(`\n실제 사용: 입력 ${usage.input} / 캐시 쓰기 ${usage.cacheWrite} / 캐시 읽기 ${usage.cacheRead} / 출력 ${usage.output} 토큰 → 약 $${cost.toFixed(3)}`);
  console.log(`결과 파일: ${file}`);

  if (!APPLY) return console.log('--dry-run이라 DB는 건드리지 않았어요');
  let saved = 0;
  for (const o of out.filter((x) => !x.error)) {
    // 확인 필요/확정이 모두 비어도 "처리함"으로 시각을 남김. 이미 처리된 행은 건드리지 않음. 기존 activities는 쓰지 않음
    const { error: e } = await supabase.from('games').update({
      activities_confirmed: o.confirmed, activities_unsure: o.unsure, activities_evidence: o.evidence, activities_ai_at: new Date().toISOString(),
    }).eq('id', o.id).is('activities_ai_at', null);
    if (e) console.log(`❌ 저장 실패 ${o.name}: ${e.message}`); else saved++;
  }
  console.log(`저장 ${saved}/${out.filter((x) => !x.error).length}개 (오류 ${out.filter((x) => x.error).length}개는 저장 안 함 → 다시 실행하면 이어서 처리)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
