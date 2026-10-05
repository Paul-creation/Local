// scripts/judge-new-games.mjs
// 이번 주 새 게임의 진입장벽(entry_barrier·reason)과 혼자 플레이 단계(solo_mode)를 채움 (매주 갱신, 태그 연결 다음 단계)
// 실행: node --env-file=.env.local scripts/judge-new-games.mjs              (미리보기 — AI 안 부르고 대상·예상 비용만)
//       node --env-file=.env.local scripts/judge-new-games.mjs --apply      (AI 판단 후 저장 — 매주 갱신이 쓰는 방식)
//       --existing  날짜 조건 없이 entry_barrier·solo_mode가 미정인 기존 게임을 대상으로 (기본 동작은 그대로. --apply와 같이, --sample N과도 같이 쓰면 N개만 실제 판단)
//       --existing --sample N  (--apply 없이) 기존 게임 N개를 실제로 AI에 물어 결과만 보여줌, DB는 안 바꿈 (Haiku 1번 호출)
//       --ids <파일>  지정한 게임만 (lib/only-ids.mjs, 대상 조건은 그대로)
//       node --env-file=.env.local scripts/judge-new-games.mjs --sample 20  (예전 게임 20개로 프롬프트를 만들어 예상 비용만 계산, AI·DB 안 씀)
// - 대상: 숨기지 않은 게임 중 이번 주(7일 안)에 들어왔고 이 기능 시작(NEW_SINCE) 뒤에 들어온 게임, entry_barrier나 solo_mode가 빈 것
//   예전 미정(null) 게임은 일부러 그대로 둠. 한 번 판단한 게임(filter_ai_at)은 다시 묻지 않음. 한 번에 최대 200개
// - 기준: docs/verification-rules.md, data/tags/entry-barrier.json(rule)·data/meta/play-modes.json과 같음
//   진입장벽은 난이도가 아니라 "처음 하는 사람이 얼마나 빨리 같이 즐길 수 있나". 확신 없으면 null
// - 혼자 플레이: 스팀 태그에 멀티 관련 태그가 하나도 없으면 AI 없이 story (play-modes.json에서 271개 중 268개 일치, 나머지 3개는 프로그램·보류)
// - 이미 값이 있는 칸은 덮어쓰지 않음. party_max·session_max는 건드리지 않음
// - AI: Haiku, 20개씩 묶어 1번 (scripts/는 CLAUDE.md 규칙상 guardedClaudeFetch 예외 — 사이트 하루 AI 상한을 쓰지 않도록 직접 호출)
//   200개 기준 약 10번 호출, 예상 $0.1 안팎. 누적 $1를 넘으면 멈춤
// - 스팀 태그는 link-new-game-tags.mjs가 남긴 scripts/.cache/new-game-steam-tags.json을 쓰고, 없으면 직접 받음
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { fetchSteamTags } from './lib/steam-tags.mjs';
import { onlyIds } from './lib/only-ids.mjs';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const APPLY = process.argv.includes('--apply');
const EXISTING = process.argv.includes('--existing');
const SAMPLE = process.argv.includes('--sample') ? Number(process.argv[process.argv.indexOf('--sample') + 1]) || 20 : 0;
const NEW_SINCE = '2026-10-05T00:00:00Z'; // 이 기능을 넣은 날 — 그 전에 들어온 게임은 대상 아님
const DRY_AI = SAMPLE && EXISTING && !APPLY; // 기존 게임 N개 판단 결과만 보기 (저장 안 함)
const MAX_GAMES = 200;
const BATCH = 20;
const MAX_COST_USD = 1;
const MODEL = 'claude-haiku-4-5-20251001';
const PRICE = { input: 1 / 1e6, output: 5 / 1e6 }; // Haiku 4.5 ($/토큰)
const CACHE = 'scripts/.cache/new-game-steam-tags.json';
const BARRIERS = ['낮음', '보통', '높음'];
const SOLOS = ['story', 'possible', 'none'];

// 멀티 관련 스팀 태그 = excluded.json의 "인원·협동·대전·멀티" 묶음에서 Singleplayer만 뺀 것
const MULTI_TAGS = new Set(JSON.parse(fs.readFileSync('data/tags/excluded.json', 'utf8')).tags
  .filter((t) => t.reason.startsWith('인원') && t.id !== 4182).map((t) => t.id));

const PROMPT_HEAD = `너는 한국 게임 정보 사이트의 필터 데이터를 채우는 사람이야. 아래 게임마다 두 가지를 판단해.

[진입장벽 barrier] 난이도가 아니라 "그 게임을 처음 하는 사람이 얼마나 빨리 친구와 같이 즐길 수 있나"
- 조작·규칙의 복잡함, 처음에 배울 양, 실력 차이가 같이 하는 재미를 망치는 정도로 판단
- "낮음": 바로 같이 즐김 / "보통": 조금 익혀야 함 / "높음": 배울 게 많거나 실력차가 재미를 크게 좌우
- reason: 판단 이유를 한국어 20자 안팎 한 구절로 (예시 말투 참고)
- 게임을 잘 모르거나 확신이 없으면 barrier와 reason 모두 null
- 예시: Lethal Company 낮음 "줍고 나르고 도망치는 간단한 협동" / Overcooked! 2 낮음 "몇 가지 버튼으로 하는 협동 요리" / Stardew Valley 낮음 "하루 일과가 단순해 금방 익힘" / Portal 낮음 "포털 쏘기 하나로 시작하는 퍼즐" / Among Us 낮음 "규칙이 단순한 마피아 게임" / It Takes Two 낮음 "둘이 바로 하는 쉬운 협동 어드벤처"
  Deep Rock Galactic 보통 "직업 역할과 협동을 익혀야 함" / Phasmophobia 보통 "귀신 증거 찾는 법을 익혀야 함" / Terraria 보통 "할 일이 많아 익숙해져야 함" / Hollow Knight 보통 "탐험과 보스전이 꽤 어려움" / Rocket League 보통 "조작은 단순하나 실력차 큼" / PUBG 보통 "슈팅 실력차가 있음" / Dead by Daylight 보통 "생존자는 쉽지만 킬러 실력차 큼"
  League of Legends 높음 "챔피언·운영 학습량과 실력차 큼" / Counter-Strike 2 높음 "정확한 사격·전술 실력차 큼" / Baldur's Gate 3 높음 "규칙과 선택지가 많은 CRPG" / Civilization VI 높음 "규칙과 시대별 요소가 많은 4X" / Monster Hunter: World 높음 "무기·시스템이 많아 배울 게 많음" / Street Fighter 6 높음 "격투 콤보 실력차가 큼" / Rust 높음 "생존·건설에 PvP 실력차 큼"

[혼자 플레이 solo] ("solo 판단 필요"라고 적힌 게임만, 나머지는 null)
- "story": 혼자서도 완결된 경험 (스토리 캠페인·싱글 콘텐츠가 핵심급). 1인 전용 게임은 모두 여기 (예: Baldur's Gate 3, Terraria, Portal 2)
- "possible": 혼자 할 수 있는 모드(봇·AI 상대, 싱글 캠페인 등)가 있지만 본편은 협동·대전 중심 (예: Deep Rock Galactic, Lethal Company, Rocket League, Street Fighter 6)
- "none": 온라인 매칭 전용이거나, 혼자서는 봇·AI 상대가 없어 사실상 할 수 없는 멀티 전용 (예: League of Legends, Among Us, It Takes Two, PUBG)
- 근거: 스팀 태그(Singleplayer·Story Rich와 멀티 관련 태그의 투표 비율), 소개 문구, 게임을 아는 범위의 판단
- 애매하면 possible로 뭉뚱그리지 말고 solo와 solo_reason 모두 null (게임을 모르거나 혼자 모드가 있는지 확신이 없을 때)
- solo_reason: solo를 정한 근거를 한국어 20자 안팎 한 구절로

게임 목록 (스팀 태그는 영어 이름(투표 수), 투표 많은 순):
`;
const PROMPT_TAIL = `
번호 순서대로 JSON으로만 답해. 설명이나 코드블록은 쓰지 마.
{"games": [{"index": 1, "barrier": "낮음", "reason": "줍고 나르고 도망치는 간단한 협동", "solo": "possible", "solo_reason": "혼자 할 수 있지만 협동이 핵심"}]}`;

const clean = (s, max) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, max);

function buildPrompt(items) {
  const lines = items.map((it, i) => {
    const asks = [it.askBarrier && 'barrier 판단 필요', it.askSolo && 'solo 판단 필요'].filter(Boolean).join(' · ');
    const tags = it.steamTags.slice(0, 20).map((t) => `${t.en}(${t.votes})`).join(', ') || '(태그 없음)';
    return `${i + 1}. ${it.game.name} [${asks}]\n   소개: ${clean(it.game.description, 200) || '(없음)'}\n   스팀 태그: ${tags}`;
  });
  return PROMPT_HEAD + lines.join('\n') + PROMPT_TAIL;
}

// 토큰 수 어림 (실제 호출 전 예상 비용용): 영문·숫자 4글자 ≈ 1토큰, 한글 등 1글자 ≈ 1토큰 (넉넉하게)
const estimateTokens = (text) => {
  const nonAscii = (text.match(/[^\x00-\x7f]/g) || []).length;
  return Math.ceil((text.length - nonAscii) / 4 + nonAscii);
};
const OUTPUT_TOKENS_PER_GAME = 60; // {"index":n,"barrier":"보통","reason":"…20자…","solo":"story"} 한 줄 어림

async function askHaiku(prompt) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: MODEL, max_tokens: 4000, messages: [{ role: 'user', content: prompt }] }),
    signal: AbortSignal.timeout(120000),
  });
  const json = await res.json();
  if (json.error) throw new Error(`HTTP ${res.status} ${json.error.message}`);
  if (json.stop_reason === 'max_tokens') throw new Error('답이 중간에 잘림 (max_tokens)');
  const text = (json.content || []).map((c) => c.text || '').join('');
  const parsed = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
  const u = json.usage || {};
  return { rows: parsed.games || [], cost: (u.input_tokens || 0) * PRICE.input + (u.output_tokens || 0) * PRICE.output, usage: u };
}

async function hasMigration() {
  const { error } = await supabase.from('games').select('filter_ai_at').limit(1);
  return !error;
}

async function loadTargets(migrated) {
  const cols = `id, name, steam_appid, description, created_at, entry_barrier, solo_mode${migrated ? ', filter_ai_at' : ''}`;
  if (SAMPLE && !EXISTING) {
    // 비용 어림용: 예전 게임 중 아무거나 (판단은 안 함)
    const { data, error } = await supabase.from('games').select(cols).eq('hidden', false).not('steam_appid', 'is', null)
      .order('created_at', { ascending: false }).limit(SAMPLE);
    if (error) throw new Error(error.message);
    return data.map((g) => ({ ...g, entry_barrier: null, solo_mode: null }));
  }
  if (DRY_AI) {
    // 미리보기: 진입장벽만 빈 3 · 혼자만 빈 3 · 둘 다 빈 4 (SAMPLE=10 기준 비율, 아니면 3:3:나머지)
    const { data, error } = await supabase.from('games').select(cols).eq('hidden', false)
      .or('entry_barrier.is.null,solo_mode.is.null').order('created_at', { ascending: true });
    if (error) throw new Error(error.message);
    const rows = data.filter((g) => !migrated || !g.filter_ai_at);
    const n = Math.min(3, Math.floor(SAMPLE * 0.3));
    return [...rows.filter((g) => !g.entry_barrier && g.solo_mode).slice(0, n),
      ...rows.filter((g) => g.entry_barrier && !g.solo_mode).slice(0, n),
      ...rows.filter((g) => !g.entry_barrier && !g.solo_mode).slice(0, SAMPLE - 2 * n)];
  }
  let q = onlyIds(supabase.from('games').select(cols)).eq('hidden', false)
    .or('entry_barrier.is.null,solo_mode.is.null').order('created_at', { ascending: true }).limit(SAMPLE && EXISTING ? SAMPLE : MAX_GAMES);
  if (!EXISTING) {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    q = q.gte('created_at', weekAgo > NEW_SINCE ? weekAgo : NEW_SINCE);
  }
  if (migrated) q = q.is('filter_ai_at', null);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data;
}

async function main() {
  console.log(DRY_AI ? `🔍 기존 게임 ${SAMPLE}개 판단 결과 미리보기 (AI 부름, DB 저장 안 함)` : SAMPLE ? `🧮 비용 어림 (예전 게임 ${SAMPLE}개로 프롬프트만 만듦, AI·DB 안 씀)` : APPLY ? '🟢 저장 모드' : '👀 미리보기 (AI 안 부름, 저장하려면 --apply)');
  const migrated = await hasMigration();
  if (!migrated) console.log('⚠️ 마이그레이션 20261013090000_new_game_tagging.sql 전 — 처리 표시(filter_ai_at) 없이 진행');
  const games = await loadTargets(migrated);
  console.log(`대상 ${games.length}개${games.length >= MAX_GAMES ? ` (한 번에 최대 ${MAX_GAMES}개)` : ''}\n`);
  if (!games.length) return;

  const cache = fs.existsSync(CACHE) ? JSON.parse(fs.readFileSync(CACHE, 'utf8')).games || {} : {};
  const items = [];
  const now = () => new Date().toISOString();
  let ruleStory = 0;
  for (const g of games) {
    let steamTags = cache[g.id];
    if (!steamTags && g.steam_appid) {
      try { steamTags = await fetchSteamTags(g.steam_appid); } catch (e) { console.log(`   ${g.name}: 스팀 태그 못 받음 (${e.message}) — 소개 문구로만 판단`); }
    }
    steamTags ||= [];
    const it = { game: g, steamTags, askBarrier: !g.entry_barrier, askSolo: false, patch: {} };
    if (!g.solo_mode) {
      // 스팀 태그가 있는데 멀티 관련 태그가 하나도 없으면 1인 전용 → story (AI 안 물음)
      if (steamTags.length && !steamTags.some((t) => MULTI_TAGS.has(t.id))) { it.patch.solo_mode = 'story'; ruleStory++; }
      else it.askSolo = true;
    }
    items.push(it);
  }
  const askItems = items.filter((it) => it.askBarrier || it.askSolo);
  const batches = Array.from({ length: Math.ceil(askItems.length / BATCH) }, (_, i) => askItems.slice(i * BATCH, i * BATCH + BATCH));
  console.log(`혼자 플레이: 규칙으로 story ${ruleStory}개 · AI에 물을 것 ${askItems.filter((it) => it.askSolo).length}개`);
  console.log(`진입장벽: AI에 물을 것 ${askItems.filter((it) => it.askBarrier).length}개 → Haiku ${batches.length}번 호출`);

  if (!APPLY && !DRY_AI) {
    const inTok = batches.reduce((s, b) => s + estimateTokens(buildPrompt(b)), 0);
    const outTok = askItems.length * OUTPUT_TOKENS_PER_GAME;
    const cost = inTok * PRICE.input + outTok * PRICE.output;
    const per = cost / (askItems.length || 1);
    console.log(`\n💰 예상 비용: 입력 약 ${inTok.toLocaleString()} · 출력 약 ${outTok.toLocaleString()} 토큰 → 약 $${cost.toFixed(4)}`);
    console.log(`   게임당 약 $${per.toFixed(5)} · 주 ${MAX_GAMES}개 기준 약 $${(per * MAX_GAMES).toFixed(3)}`);
    if (!SAMPLE) for (const it of items) console.log(`  - ${it.game.name}: ${[it.askBarrier && '진입장벽', it.askSolo && '혼자 플레이(AI)', it.patch.solo_mode && '혼자 플레이=story(규칙)'].filter(Boolean).join(' · ')}`);
    return;
  }

  let totalCost = 0, saved = 0;
  const failed = [];
  for (const [bi, batch] of batches.entries()) {
    if (totalCost > MAX_COST_USD) { console.log(`💸 누적 $${totalCost.toFixed(3)} — 상한 $${MAX_COST_USD} 넘어서 멈춤`); break; }
    try {
      const { rows, cost, usage } = await askHaiku(buildPrompt(batch));
      totalCost += cost;
      console.log(`[${bi + 1}/${batches.length}] Haiku 입력 ${usage.input_tokens} · 출력 ${usage.output_tokens} 토큰 (약 $${cost.toFixed(4)})`);
      batch.forEach((it, i) => {
        const r = rows.find((x) => Number(x.index) === i + 1) || {};
        if (it.askBarrier && BARRIERS.includes(r.barrier)) {
          it.patch.entry_barrier = r.barrier;
          it.patch.entry_barrier_reason = clean(r.reason, 60) || null;
        }
        if (it.askSolo && SOLOS.includes(r.solo)) it.patch.solo_mode = r.solo;
        if (it.askSolo) it.soloReason = clean(r.solo_reason, 60); // 저장 안 함, 미리보기 표시용
        it.asked = true;
      });
    } catch (e) {
      failed.push(`${bi + 1}번째 묶음 (${batch.map((it) => it.game.name).join(', ')}): ${e.message}`);
    }
  }

  // 빈 칸만 채움: 읽은 뒤 다른 단계가 채웠을 수도 있어서 칸별로 "비어 있을 때만" 조건을 붙여 씀
  const updates = (p) => [
    p.entry_barrier && ['entry_barrier', { entry_barrier: p.entry_barrier, entry_barrier_reason: p.entry_barrier_reason }],
    p.solo_mode && ['solo_mode', { solo_mode: p.solo_mode }],
  ].filter(Boolean);
  for (const it of items) {
    if ((it.askBarrier || it.askSolo) && !it.asked) continue; // AI 실패한 게임은 표시하지 않음 → 다음 실행에 다시
    let ok = true;
    if (DRY_AI) { console.log(`  - ${it.game.name}: 진입장벽 ${it.patch.entry_barrier ?? 'null(보류)'}${it.patch.entry_barrier_reason ? ` "${it.patch.entry_barrier_reason}"` : ''} · 혼자 ${it.patch.solo_mode ?? (it.askSolo ? 'null(보류)' : '그대로')}${it.soloReason ? ` "${it.soloReason}"` : ''}`); continue; }
    for (const [field, value] of updates(it.patch)) {
      const { error } = await supabase.from('games').update(value).eq('id', it.game.id).is(field, null);
      if (error) { ok = false; failed.push(`${it.game.name}: 저장 실패 (${error.message})`); }
    }
    if (ok && migrated) await supabase.from('games').update({ filter_ai_at: now() }).eq('id', it.game.id);
    if (ok) saved++;
    console.log(`  - ${it.game.name}: 진입장벽 ${it.patch.entry_barrier ?? (it.askBarrier ? 'null(보류)' : '그대로')}${it.patch.entry_barrier_reason ? ` "${it.patch.entry_barrier_reason}"` : ''} · 혼자 ${it.patch.solo_mode ?? (it.askSolo ? 'null(보류)' : '그대로')}`);
  }
  console.log(`\n${DRY_AI ? '(저장 안 함) ' : ''}✅ ${saved}개 게임 처리 · AI 비용 약 $${totalCost.toFixed(4)}`);
  if (failed.length) {
    console.log(`❌ 실패 ${failed.length}개`);
    for (const f of failed) console.log(`  - ${f}`);
    process.exitCode = 1;
  }
}

main().catch((e) => { console.error(e.message); process.exit(1); });
