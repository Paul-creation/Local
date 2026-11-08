// scripts/polite-fun-descriptions.mjs
// 한 줄 소개(fun_description)를 해라체(~다)·명사형 끝에서 해요체 한 문장으로 바꾼다. 뜻은 그대로, 말투만.
// 실행: node --env-file=.env.local scripts/polite-fun-descriptions.mjs            (생성만: DB 읽기 + AI 호출, 결과는 캐시 파일에 저장. DB에는 안 씀)
//       node --env-file=.env.local scripts/polite-fun-descriptions.mjs --apply    (캐시의 결과를 DB에 저장: 바꾸기 전 값은 fun_description_before에 남기고, 그사이 소개가 바뀐 게임은 건너뜀)
//       --limit N  (테스트용으로 앞 N개만)   --cache <파일>  (기본 /workspaces/shots/fun-polite.json, 레포 밖)
// - 20개씩 묶어 Haiku 1번 호출. 검사(isPolite)에 걸린 것은 걸린 이유를 알려 주고 다시 받음(최대 3번 시도). 끝내 못 고친 것은 저장하지 않음(원래 값 유지)
// - 누적 비용이 $1을 넘으면 멈추고 알림. 이미 캐시에 있는 게임은 다시 부르지 않음
// - --apply 전 추가 SQL: alter table games add column if not exists fun_description_before text;
// (scripts/는 CLAUDE.md 규칙상 guardedClaudeFetch 예외 — 직접 호출)
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const argAfter = (f) => (process.argv.includes(f) ? process.argv[process.argv.indexOf(f) + 1] : null);
const APPLY = process.argv.includes('--apply');
const LIMIT = Number(argAfter('--limit')) || 0;
const CACHE = argAfter('--cache') ?? '/workspaces/shots/fun-polite.json';
const MODEL = 'claude-haiku-4-5-20251001';
const PRICE_IN = 1 / 1e6, PRICE_OUT = 5 / 1e6, MAX_COST = 1;
const BATCH = 20;

const SYSTEM = `너는 게임 소개 문장의 말투만 바꾸는 교정자다. 입력은 번호가 붙은 한 줄 소개 목록이다.

규칙:
- 각 소개를 해요체(~해요, ~예요, ~이에요, ~있어요, ~돼요 등) 한 문장으로 바꾼다. 문장이 둘이면 뜻을 지키며 하나로 잇는다
- 뜻·사실·정보는 그대로 둔다. 새 내용을 더하거나 빼지 않는다. 숫자·고유명사(게임·캐릭터·지명 이름)는 그대로 쓴다
- 담백하게 쓴다. 과장·감탄·이모지·따옴표·물음표는 쓰지 않는다
- 동사·형용사 활용을 정확히 쓴다 (예: 누비다 → "누빌 수 있어요", 돕다 → "도와요", 잇다 → "이어요"). 문장을 이을 때는 "~이며"보다 "~이고", "~하고", "~해서"처럼 자연스러운 말을 쓴다
- 길이는 원문과 비슷하게, 최대 85자
- 끝은 "요."로 마친다. "~다."로 끝내지 않는다

출력: 입력과 같은 순서·같은 개수의 JSON 문자열 배열 하나만 출력한다. 다른 글은 쓰지 않는다.
예) 입력 ["1. 혼자 하는 법정 추리 게임이다.", "2. 친구와 함께 레이싱을 한다. 낮과 밤이 달라진다."]
출력 ["혼자 하는 법정 추리 게임이에요.", "친구와 함께 레이싱을 하고, 낮과 밤의 분위기가 달라요."]`;

const nums = (s) => (s.match(/\d+/g) ?? []).join(',');

// 검사: 해요체 한 문장, 길이, 숫자 그대로. 통과하면 null, 아니면 이유
export function isPolite(before, after) {
  if (typeof after !== 'string') return '문자열이 아님';
  const t = after.trim();
  if (!t) return '빈 문장';
  if (t.length > 85) return `${t.length}자라 너무 김 (85자 이하)`;
  if (t.length < 10) return `${t.length}자라 너무 짧음`;
  if (!/요\.$/.test(t)) return '끝이 "요."가 아님';
  if ((t.match(/[.!?]/g) ?? []).length !== 1) return '한 문장이 아님';
  if (/["“”'‘’#?!]|[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(t)) return '따옴표·이모지·느낌표·물음표';
  if (nums(t) !== nums(before)) return `숫자가 원문과 다름 (${nums(before) || '없음'} → ${nums(t) || '없음'})`;
  return null;
}

const usage = { input: 0, output: 0 };
const cost = () => usage.input * PRICE_IN + usage.output * PRICE_OUT;

async function ask(items, feedback) {
  const prompt = JSON.stringify(items.map((x, i) => `${i + 1}. ${x.before}`))
    + (feedback ? `\n\n앞 답에서 아래가 규칙을 어겼다. 규칙을 지켜 전체 ${items.length}개를 다시 출력해:\n${feedback}` : '');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: MODEL, max_tokens: 3000, system: SYSTEM, messages: [{ role: 'user', content: prompt }] }),
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  usage.input += json.usage?.input_tokens || 0;
  usage.output += json.usage?.output_tokens || 0;
  const text = (json.content || []).map((c) => c.text || '').join('');
  const m = text.match(/\[[\s\S]*\]/);
  const arr = m ? JSON.parse(m[0]) : null;
  if (!Array.isArray(arr) || arr.length !== items.length) throw new Error(`답 개수가 달라요 (${arr?.length ?? '없음'} / ${items.length})`);
  return arr.map((s) => String(s).replace(/^\d+\.\s*/, '').replace(/\s+/g, ' ').trim());
}

async function loadAll(supabase) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('games').select('id, name, fun_description').eq('hidden', false).not('fun_description', 'is', null).order('id').range(from, from + 999);
    if (error) throw new Error(error.message);
    rows.push(...data);
    if (data.length < 1000) break;
  }
  return rows.filter((r) => r.fun_description.trim());
}

const readCache = () => (fs.existsSync(CACHE) ? JSON.parse(fs.readFileSync(CACHE, 'utf8')) : {});
const writeCache = (c) => { fs.mkdirSync(path.dirname(CACHE), { recursive: true }); fs.writeFileSync(CACHE, JSON.stringify(c, null, 1)); };

async function generate(supabase) {
  if (!process.env.ANTHROPIC_API_KEY) return console.error('.env.local에 ANTHROPIC_API_KEY가 없어요');
  let games = await loadAll(supabase);
  if (LIMIT) games = games.slice(0, LIMIT);
  const cache = readCache();
  const todo = games.filter((g) => !cache[g.id]);
  console.log(`한 줄 소개 ${games.length}개 중 새로 바꿀 ${todo.length}개 (캐시 ${games.length - todo.length}개) · ${Math.ceil(todo.length / BATCH)}번 호출 · ${CACHE}`);
  let failed = 0;
  for (let i = 0; i < todo.length; i += BATCH) {
    if (cost() > MAX_COST) { console.log(`💸 누적 $${cost().toFixed(3)} — 상한 $${MAX_COST} 넘어서 멈춤. 캐시는 저장됨`); break; }
    let items = todo.slice(i, i + BATCH).map((g) => ({ id: g.id, name: g.name, before: g.fun_description.trim() }));
    let feedback = null;
    for (let attempt = 0; attempt < 3 && items.length; attempt++) {
      let out;
      try { out = await ask(items, feedback); } catch (e) { console.log(`   ⚠️ ${e.message} — 다시 시도`); feedback = null; continue; }
      const bad = [];
      items.forEach((x, k) => {
        const why = isPolite(x.before, out[k]);
        if (why) bad.push({ n: k + 1, x, why, line: out[k] }); else cache[x.id] = { name: x.name, before: x.before, after: out[k] };
      });
      // 다음 시도는 실패한 것만 보낸다 (번호는 새 목록 기준으로 다시 매김)
      items = bad.map((b) => b.x);
      feedback = bad.map((b, j) => `- ${j + 1}번 앞 답 "${b.line}": ${b.why}`).join('\n') || null;
    }
    failed += items.length;
    for (const x of items) console.log(`🚫 ${x.name} — 검사를 못 넘겨 원래 값 유지: ${x.before}`);
    writeCache(cache);
    console.log(`  ${Math.min(i + BATCH, todo.length)}/${todo.length} · 누적 $${cost().toFixed(4)}`);
  }
  console.log(`\n완료 — 캐시 ${Object.keys(cache).length}개 · 검사 탈락 ${failed}개 · 토큰 입력 ${usage.input} / 출력 ${usage.output} · 약 $${cost().toFixed(4)}`);
}

async function apply(supabase) {
  const probe = await supabase.from('games').select('fun_description_before').limit(1);
  if (probe.error) return console.error('games.fun_description_before 칸이 없어요. 먼저 SQL 에디터에서 실행: alter table games add column if not exists fun_description_before text;');
  const cache = readCache();
  let ok = 0, skipped = 0, bad = 0;
  for (const [id, c] of Object.entries(cache)) {
    if (isPolite(c.before, c.after)) { bad++; continue; }
    // 그사이 소개가 바뀐 게임은 건너뛰고, 바꾸기 전 값이 이미 백업돼 있으면 백업은 그대로 둔다
    const cur = await supabase.from('games').select('fun_description, fun_description_before').eq('id', id).maybeSingle();
    if (cur.error || !cur.data || cur.data.fun_description !== c.before) { skipped++; continue; }
    const patch = { fun_description: c.after, ...(cur.data.fun_description_before == null ? { fun_description_before: c.before } : {}) };
    const { error } = await supabase.from('games').update(patch).eq('id', id).eq('fun_description', c.before);
    if (error) { console.log(`⚠️ ${c.name}: ${error.message}`); skipped++; } else ok++;
  }
  console.log(`저장 ${ok}개 · 건너뜀 ${skipped}개(그사이 소개가 바뀜 등) · 검사 탈락 ${bad}개`);
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url))) {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  (APPLY ? apply(supabase) : generate(supabase)).catch((e) => { console.error(e.message); process.exit(1); });
}
