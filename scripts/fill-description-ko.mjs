// scripts/fill-description-ko.mjs
// 스팀 한국어 설명이 없는 게임에 한국어 상세 설명(games.description_ko, 2~3문장 존댓말)을 씀 — 스팀 영어 about_the_game을 바탕으로, 상세 페이지 소개의 한 줄 요약 아래에 보임
// 실행: node --env-file=.env.local scripts/fill-description-ko.mjs               (미리보기 — 대상 수와 예상 비용만, 스팀 영어 설명을 받아 scripts/.cache/about-en.json에 저장, DB·AI 안 씀)
//       node --env-file=.env.local scripts/fill-description-ko.mjs --apply       (AI로 쓰고 저장)
//       --ids <파일>  지정한 게임만 (lib/only-ids.mjs)   --limit N  최대 N개   --retry  처리 표시(description_ko_at)가 있어도 description_ko가 빈 게임을 다시
// - 대상: 숨기지 않은 스팀 게임 중 description(한국어 상점 설명)에 한글이 없는 게임, description_ko·description_ko_at이 비어 있는 게임. 이미 쓴 값은 덮어쓰지 않음
// - 한 번 처리한 게임은 description_ko_at을 남겨 다시 안 함 (검사 탈락 포함, --retry로 재시도). 스팀 요청 실패·API 오류는 표시 없이 다음에 재시도
// - 칸이 없으면(마이그레이션 supabase/migrations/20261108090000_description_ko.sql 전) 안내만 하고 정상 종료
// - AI: Haiku (scripts/는 CLAUDE.md 규칙상 guardedClaudeFetch 예외). 누적 $1 넘으면 멈춤. 규칙 검사는 lib/description-ko.mjs
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { steamGet, appdetailsUrl } from './lib/steam.mjs';
import { onlyIds } from './lib/only-ids.mjs';
import { aboutToText, lacksSteamKorean, needsDescriptionKo, checkDescriptionKo } from './lib/description-ko.mjs';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const arg = (f) => (process.argv.includes(f) ? process.argv[process.argv.indexOf(f) + 1] : null);
const APPLY = process.argv.includes('--apply');
const RETRY = process.argv.includes('--retry');
const LIMIT = Number(arg('--limit')) || null;
const CACHE = 'scripts/.cache/about-en.json';
const MODEL = 'claude-haiku-4-5-20251001';
const PRICE = { input: 1 / 1e6, output: 5 / 1e6 };
const MAX_COST_USD = 1;
const OUT_TOKENS = 200; // 2~3문장 어림
const estimateTokens = (t) => { const k = (t.match(/[^\x00-\x7f]/g) || []).length; return Math.ceil((t.length - k) / 4 + k); };

const SYSTEM = `너는 한국 게임 정보 사이트의 상세 설명을 쓴다. 스팀 영어 설명(about the game)을 읽고 "어떤 게임이고, 친구랑 하면 뭐가 재밌는지"를 한국어 2~3문장으로 쓴다.
규칙:
- 해요체로 쓴다. 모든 문장이 "~요."로 끝난다(~에요·~예요·~어요·~거든요). "~입니다"·"~합니다"·"~하세요"는 쓰지 않는다. 번역투 말고 한국어로 자연스럽게 쓴다.
- 전체 250자 이내(200자 안팎이 좋다). 길게 나열하지 말고 핵심만 쓴다.
- 설명에 적힌 사실만 쓴다. 과장·추측·광고 문구("최고의", "놓치지 마세요", "역대급")를 쓰지 않는다. 설명에 없는 인원 수·기능·출시 정보를 만들지 않는다.
- 1문장: 어떤 게임인지(장르·배경·핵심 행동). 2~3문장: 친구와 함께 할 때 생기는 상황이나 재미. 멀티 요소가 설명에 없으면 억지로 지어내지 말고 게임 내용만 쓴다.
- 게임 이름은 반복하지 않아도 된다. 마크다운·목록·이모지·따옴표 인용을 쓰지 않는다. 답은 설명 본문만, 다른 말 없이.`;

const userPrompt = (g, about) => `게임: ${g.name}\n${g.max_players ? `최대 인원(참고): ${g.max_players}\n` : ''}${g.tags?.length ? `태그: ${g.tags.slice(0, 8).join(', ')}\n` : ''}\n[스팀 영어 설명]\n${about}`;

async function askHaiku(messages, usage) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: MODEL, max_tokens: 500, system: SYSTEM, messages }),
    signal: AbortSignal.timeout(60000),
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  usage.input += json.usage?.input_tokens || 0;
  usage.output += json.usage?.output_tokens || 0;
  return (json.content || []).map((c) => c.text || '').join('').trim().replace(/\s*\n+\s*/g, ' ');
}

async function loadTargets() {
  const probe = await supabase.from('games').select('description_ko, description_ko_at').limit(1);
  if (probe.error) { console.log(`games.description_ko 칸이 없어요 (${probe.error.message}) — supabase/migrations/20261108090000_description_ko.sql 실행 뒤에 다시 돌려 주세요`); return null; }
  let rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await onlyIds(supabase.from('games').select('id, name, steam_appid, description, description_ko, description_ko_at, max_players, tags')).eq('hidden', false).not('steam_appid', 'is', null).order('id').range(from, from + 999);
    if (error) throw new Error(error.message);
    rows.push(...data);
    if (data.length < 1000) break;
  }
  rows = rows.filter((g) => (RETRY ? lacksSteamKorean(g) && !g.description_ko : needsDescriptionKo(g)));
  return LIMIT ? rows.slice(0, LIMIT) : rows;
}

async function fetchAbout(g, cache) {
  if (cache[g.steam_appid]) return cache[g.steam_appid];
  const json = await steamGet(appdetailsUrl(g.steam_appid, 'english'));
  const d = json?.[g.steam_appid];
  const about = d?.success ? aboutToText(d.data.about_the_game || d.data.detailed_description || d.data.short_description) : '';
  if (about) cache[g.steam_appid] = about;
  return about;
}

async function main() {
  if (APPLY && !process.env.ANTHROPIC_API_KEY) return console.error('.env.local에 ANTHROPIC_API_KEY가 없어요');
  const games = await loadTargets();
  if (!games) return;
  console.log(`${APPLY ? '반영' : '미리보기'} — 스팀 한국어 설명이 없는 게임 중 대상 ${games.length}개\n`);
  if (!games.length) return;
  fs.mkdirSync('scripts/.cache', { recursive: true });
  const cache = fs.existsSync(CACHE) ? JSON.parse(fs.readFileSync(CACHE, 'utf8')) : {};
  const save = () => fs.writeFileSync(CACHE, JSON.stringify(cache));

  if (!APPLY) {
    let inTok = 0, got = 0, noAbout = 0;
    for (const g of games) {
      let about = '';
      try { about = await fetchAbout(g, cache); } catch (e) { console.log(`   ${g.name}: 스팀 요청 실패 (${e.message})`); }
      if (!about) { noAbout++; continue; }
      got++;
      inTok += estimateTokens(SYSTEM + userPrompt(g, about));
      if (got % 20 === 0) save();
    }
    save();
    const outTok = got * OUT_TOKENS;
    const cost = inTok * PRICE.input + outTok * PRICE.output;
    console.log(`영어 설명을 받은 게임 ${got}개 (못 받은 ${noAbout}개)`);
    console.log(`💰 예상 비용: 입력 약 ${inTok.toLocaleString()} · 출력 약 ${outTok.toLocaleString()} 토큰 → 약 $${cost.toFixed(3)} (재시도 여유 ×1.3 = $${(cost * 1.3).toFixed(3)})`);
    return;
  }

  const usage = { input: 0, output: 0 };
  const cost = () => usage.input * PRICE.input + usage.output * PRICE.output;
  let saved = 0, rejected = 0, noAbout = 0;
  for (const g of games) {
    if (cost() > MAX_COST_USD) { console.log(`💸 누적 $${cost().toFixed(3)} — 상한 $${MAX_COST_USD} 넘어서 멈춤`); break; }
    try {
      const about = await fetchAbout(g, cache);
      if (!about) { noAbout++; console.log(`  - ${g.name}: 스팀 영어 설명 없음 — 건너뜀 (다음에 다시)`); continue; }
      const msgs = [{ role: 'user', content: userPrompt(g, about) }];
      let text = await askHaiku(msgs, usage);
      let problems = checkDescriptionKo(text);
      if (problems.length) {
        text = await askHaiku([...msgs, { role: 'assistant', content: text }, { role: 'user', content: `검사에 걸렸어. 모두 고쳐서 본문만 다시 써:\n${problems.map((p) => `- ${p}`).join('\n')}` }], usage);
        problems = checkDescriptionKo(text);
      }
      const patch = { description_ko_at: new Date().toISOString(), ...(problems.length ? {} : { description_ko: text }) };
      const q = supabase.from('games').update(patch).eq('id', g.id).is('description_ko', null);
      const { error } = await q;
      if (error) { console.log(`  - ${g.name}: 저장 실패 (${error.message})`); continue; }
      if (problems.length) { rejected++; console.log(`  - ${g.name}: 검사 탈락 — ${problems.join(' / ')} (저장 안 함)`); } else { saved++; console.log(`  - ${g.name}: ${text}`); }
    } catch (e) { console.log(`  - ${g.name}: 실패 (${e.message}) — 표시 없이 다음에 재시도`); }
    if ((saved + rejected) % 10 === 0) save();
  }
  save();
  console.log(`\n✅ 저장 ${saved}개 · 검사 탈락 ${rejected}개 · 영어 설명 없음 ${noAbout}개 · AI 비용 약 $${cost().toFixed(4)}`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
