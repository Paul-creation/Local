// scripts/write-fun-descriptions.mjs
// 게임에 "한 줄 소개"를 써서 fun_description에 저장 — 원래 설명(description)은 그대로 둠
// 기준은 data/intros/top100.json(인기 100개 소개)과 같음: 45자 내외(최대 55자, 검사는 40~60자 허용) 담백한 설명체, 친구랑 할 때 어떤 게임인지 먼저
// 실행: node --env-file=.env.local scripts/write-fun-descriptions.mjs              (기본 20개, 소개가 빈 게임만)
//       node --env-file=.env.local scripts/write-fun-descriptions.mjs 50           (개수 지정)
//       node --env-file=.env.local scripts/write-fun-descriptions.mjs --ids <id>,<id>   (지정한 게임만, 이미 있어도 다시 씀)
//       node --env-file=.env.local scripts/write-fun-descriptions.mjs --ids-file data/intros/backup-old-style-....json   (파일의 game_id 목록, 이미 있어도 다시 씀)
//       --dry-run 을 붙이면 생성만 하고 DB에는 아무것도 쓰지 않음
// - 생성 뒤 검사(checkLine): 40~60자, 금지어(과장·예전 퀘스트 말투·인원/가격 숫자 등), 멀티 없는 게임은 "혼자", 협동 게임은 "친구"
//   어긋나면 저장하지 않고 로그만 남김. AI가 확신이 없다고 답하면(없음) 비워 둠
// - 한 번 처리한 게임은 fun_description_at에 시각을 남겨 다시 부르지 않음 (검사 탈락·비워 둔 게임 포함, API 오류는 다음에 재시도)
//   칸이 아직 없으면 경고만 하고 소개가 빈 게임을 대상으로 그대로 진행
//   추가 SQL: alter table games add column if not exists fun_description_at timestamptz;
// - AI 호출: Haiku, 게임당 1번에 후보 3개 (셋 다 검사에 걸리면 이유를 알려 주고 1번 더) (scripts/는 CLAUDE.md 규칙상 guardedClaudeFetch 예외 — 사이트 하루 AI 상한을 쓰지 않도록 직접 호출)
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
const argAfter = (flag) => (process.argv.includes(flag) ? process.argv[process.argv.indexOf(flag) + 1] : null);
// --ids-file: JSON 배열(문자열 id 또는 { game_id } / { id } 행, 예: 백업 파일, data/meta/new-games-*.json)
const IDS = argAfter('--ids')?.split(',')
  ?? (argAfter('--ids-file') && JSON.parse(readFileSync(argAfter('--ids-file'), 'utf8')).map((r) => (typeof r === 'string' ? r : r.game_id ?? r.id)).filter(Boolean));
const DRY_RUN = process.argv.includes('--dry-run');
const LIMIT = (!IDS && Number(process.argv[2])) || 20;
const MODEL = 'claude-haiku-4-5-20251001';
const PRICE_IN = 1 / 1e6; // 달러/토큰 (Haiku 4.5 입력 $1/MTok)
const PRICE_OUT = 5 / 1e6; // 출력 $5/MTok
const MIN_LEN = 40;
const MAX_LEN = 60;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 예시 5개는 data/intros/top100.json에서 골라 45자 내외로 줄였다 (협동·대전·혼자 기본+협동·멀티 없음·파티 추리)
// 한 번 호출에 길이가 다른 후보 3개(35/45/55자 목표)를 JSON 배열로 받는다
const STYLE = `너는 게임 추천 사이트의 한 줄 소개를 쓴다. 읽는 사람은 "친구랑 뭐 하지?"를 고르는 중이다.

규칙:
- 공백 포함 45자 내외, 최대 55자. 한두 문장. 두 문장이면 둘째 문장은 20자 이하로 짧게 쓴다
- 담백한 설명체(~다, ~한다)로 쓴다. 명령형(~하라)이나 광고 말투는 쓰지 않는다
- 앞부분에서 친구랑 할 때 어떤 게임인지 알려 준다: 협동인지 대전인지 혼자 하는지, 같이 하는 방식, 한 판 길이, 분위기 중 맞는 것
- 멀티가 없는 게임은 혼자 즐기는 게임이라는 게 드러나게 쓴다 ("혼자"라는 말을 넣는다)
- 협동 게임은 "친구와 ~"처럼 친구와 함께 한다는 게 분명히 드러나게 쓴다
- 문장 모양을 다양하게 쓴다. "~게임으로, ~한다" 같은 틀을 반복하지 않는다
- 과장("역대급", "최고의", "인생 게임" 등), 스포일러(결말·반전·흑막)는 쓰지 않는다
- 인원 수(예: 4인, 8명, 5대5)와 가격은 화면에 따로 나오므로 숫자로 쓰지 않는다
- 아래 [게임 정보]에 있는 사실만 쓴다. 캐릭터·지명·기능을 지어내지 않는다
- 따옴표, 이모지, 해시태그는 소개 안에 쓰지 않는다

출력 형식:
- 서로 다른 길이의 후보 3개를 JSON 문자열 배열 하나로만 출력한다. 첫째는 35자, 둘째는 45자, 셋째는 55자 안팎을 목표로 한다
  예: ["후보1", "후보2", "후보3"]
- 정보가 부족하거나 어떤 게임인지 확신이 없으면 배열 대신 "없음"이라고만 답한다

좋은 예시 (45자 안팎):
- Lethal Company (온라인 협동 호러): 친구와 버려진 행성에서 고철을 모아 할당량을 채우는 협동 호러. 비명이 웃음이 된다.
- Rocket League (온라인 팀 대전): 자동차로 공을 차 넣는 팀 대전 게임. 짧은 경기를 친구와 여러 판 돌린다.
- ELDEN RING (기본 혼자, 소환 협동): 기본은 혼자 탐험하는 고난도 액션 RPG. 막힌 보스는 친구와 함께 잡는다.
- Cities: Skylines (멀티 없음): 멀티 없이 혼자 도로와 구역, 교통을 설계하는 도시 건설 시뮬레이션이다.
- Among Us (온라인 파티 추리): 친구들 사이에 숨은 임포스터를 토론과 투표로 찾는 추리 게임. 한 판이 짧다.`;

// 생성 뒤 검사에 쓰는 금지 표현 (과장·예전 퀘스트 말투·인원/가격 숫자·꾸밈 문자)
const BANNED = [
  [/역대급|최고의|최강|갓겜|인생\s?게임|끝판왕|압도적|전설적|혁명적|완벽한|미친/, '과장 표현'],
  [/(하라|어라|아라|여라|져라|워라)[.!]?(\s|$)/, '명령형(예전 퀘스트 말투)'],
  // "1대1"은 격투·카드 대전 장르 설명이라 허용 (5대5, 3vs3 등은 금지)
  [/\d+\s*(인|명)(?!칭)|\d+\s*~\s*\d+\s*인|(?<!\d)(?!1\s*대\s*1(?!\d))\d+\s*대\s*\d+/, '인원 숫자'],
  [/₩|\d[\d,]*\s*원|\$\s*\d|무료|할인/, '가격'],
  [/["“”#]|[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u, '따옴표·해시태그·이모지'],
  [/결말|반전|흑막|스포일러/, '스포일러 우려'], // "스포"만 잡으면 "스포츠"까지 걸림
  [/^[^.]{0,40}게임으로,/, '"~게임으로, ~" 틀'],
];

// "없음" 또는 "없음 (이유…)"이면 확신이 없어 비워 둔 것
const isEmpty = (line) => !line || /^없음/.test(line);
const hasCoop = (g) => !!(g.has_online_coop || g.has_local_coop);
const noMulti = (g) => g.max_players === 1 || (!hasCoop(g) && !g.has_pvp && (g.max_players ?? 1) <= 1);

// 다시 쓸 때 어긴 규칙별로 구체적으로 알려 줄 문구
const FIX = {
  '과장 표현': '과장 표현("최고의", "압도적" 등)을 빼고 담백하게 쓴다',
  '명령형(예전 퀘스트 말투)': '명령형(~하라, ~해라)이 아니라 설명체(~다, ~한다)로 끝낸다',
  '인원 숫자': '인원 수를 숫자로 쓰지 않는다 ("5대5", "4인", "8명" 금지 — "팀 대전", "여럿이"처럼 말로 쓴다)',
  '가격': '가격·무료·할인 이야기를 쓰지 않는다',
  '따옴표·해시태그·이모지': '따옴표, 해시태그, 이모지를 쓰지 않는다',
  '스포일러 우려': '결말·반전·흑막 같은 스포일러 단어를 쓰지 않는다',
  '"~게임으로, ~" 틀': '"~게임으로, ~" 틀을 쓰지 말고 문장 모양을 바꾼다',
};

// 검사에 걸리면 [{ why, fix }] 목록을, 통과하면 빈 배열을 돌려준다
function checkLine(line, game) {
  const problems = [];
  if (line.length < MIN_LEN || line.length > MAX_LEN) {
    problems.push({ why: `길이 ${line.length}자`, fix: line.length > MAX_LEN
      ? `지금 ${line.length}자라 너무 길다. 공백 포함 45자 내외(최대 55자)로 줄인다 — 두 번째 문장을 짧게 하거나 꾸밈말을 뺀다`
      : `지금 ${line.length}자라 너무 짧다. 공백 포함 45자 내외로 늘린다` });
  }
  for (const [re, why] of BANNED) if (re.test(line)) problems.push({ why, fix: FIX[why] });
  if (noMulti(game) && !line.includes('혼자')) problems.push({ why: '멀티 없는 게임인데 "혼자"가 없음', fix: '멀티가 없는 게임이므로 "혼자"라는 단어를 꼭 넣는다 (예: "혼자 즐기는 ~")' });
  if (hasCoop(game) && !line.includes('친구')) problems.push({ why: '협동 게임인데 "친구"가 없음', fix: '협동 게임이므로 "친구"라는 단어를 꼭 넣는다 (예: "친구와 ~")' });
  return problems;
}
const whyList = (problems) => problems.map((p) => p.why).join(', ');

// 통과한 후보 중 고를 때 점수 (낮을수록 좋음): 45자에서 먼 정도 + 둘째 문장이 20자를 넘으면 감점
function score(line) {
  const second = line.split(/(?<=[.!?])\s+/)[1] || '';
  return Math.abs(line.length - 45) + (second.length > 20 ? 10 : 0);
}

// AI 답에서 후보 목록을 꺼낸다. "없음"이면 빈 배열
function parseCandidates(text) {
  if (isEmpty(text)) return [];
  const m = text.match(/\[[\s\S]*\]/);
  if (m) {
    try {
      const arr = JSON.parse(m[0]);
      if (Array.isArray(arr)) return arr.map((x) => String(x).replace(/\s+/g, ' ').trim()).filter((x) => x && !isEmpty(x));
    } catch { /* 아래에서 줄 단위로 처리 */ }
  }
  return text.split('\n').map((x) => x.replace(/^[-*\d.)\s]+/, '').replace(/^["“]|["”],?$/g, '').trim()).filter((x) => x && !isEmpty(x));
}

// 후보를 검사해 통과한 것 중 가장 좋은 것을, 없으면 문제가 가장 적은 후보를 돌려준다
function pick(cands, game) {
  const checked = cands.map((line) => ({ line, problems: checkLine(line, game) }));
  const ok = checked.filter((c) => !c.problems.length).sort((a, b) => score(a.line) - score(b.line));
  if (ok.length) return ok[0];
  return checked.sort((a, b) => a.problems.length - b.problems.length || score(a.line) - score(b.line))[0] || null;
}

function gameInfo(game) {
  const yes = (v) => (v == null ? '?' : v ? '있음' : '없음');
  return [
    `이름: ${game.name}`,
    game.category ? `분류: ${game.category}` : '',
    `멀티: 온라인 협동 ${yes(game.has_online_coop)}, 로컬 협동 ${yes(game.has_local_coop)}, 대전(PvP) ${yes(game.has_pvp)}${game.server_type ? `, 접속 ${game.server_type}` : ''}`,
    `혼자 플레이: ${game.solo_playable === false ? '불가(친구 필요)' : game.solo_playable ? '가능' : '?'}`,
    `최대 인원: ${game.max_players ?? '?'} (소개에 숫자로 쓰지 말 것)`,
    game.story_length ? `플레이 분량: ${game.story_length}` : '',
    game.difficulty ? `난이도: ${game.difficulty}` : '',
    game.genres?.length ? `장르: ${game.genres.join(', ')}` : '',
    game.tags?.length ? `태그: ${game.tags.join(', ')}` : '',
    game.activities?.length ? `할 수 있는 것: ${game.activities.join(', ')}` : '',
    `공식 설명: ${String(game.description || '').replace(/\s+/g, ' ').slice(0, 300)}`,
  ].filter(Boolean).join('\n');
}

const usage = { input: 0, output: 0 };

// feedback이 있으면 앞 답과 검사 결과를 이어 붙여 한 번 더 고쳐 쓰게 한다
async function write(game, feedback) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 600,
      system: STYLE,
      messages: [
        { role: 'user', content: `[게임 정보]\n${gameInfo(game)}` },
        ...(feedback ? [
          { role: 'assistant', content: feedback.line },
          { role: 'user', content: `검사에 걸렸어. 아래를 모두 고쳐서 다시 써:\n${feedback.problems.map((p) => `- ${p.fix}`).join('\n')}\n원래 규칙(공백 포함 45자 내외·최대 55자, 둘째 문장 20자 이하, 담백한 설명체, 숫자로 인원 쓰지 않기, 멀티 없으면 "혼자"·협동이면 "친구" 넣기)도 그대로 지킨다. 후보 3개를 JSON 배열로만 출력해.` },
        ] : []),
      ],
    }),
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  usage.input += json.usage?.input_tokens || 0;
  usage.output += json.usage?.output_tokens || 0;
  return (json.content || []).map((c) => c.text || '').join('').trim();
}

// 처리 기록: fun_description_at 칸이 있으면 시각을 남겨 다음 주에 다시 부르지 않음
let hasMarker = true;
async function markDone(id, line) {
  if (DRY_RUN) return;
  const patch = { ...(line ? { fun_description: line } : {}), ...(hasMarker ? { fun_description_at: new Date().toISOString() } : {}) };
  if (Object.keys(patch).length === 0) return;
  // 이미 있는 소개는 덮어쓰지 않음 (--ids로 지정한 경우만 다시 씀)
  let q = supabase.from('games').update(patch).eq('id', id);
  if (!IDS && line) q = q.is('fun_description', null);
  const { error } = await q;
  if (error) console.log(`   ⚠️  저장 실패: ${error.message}`);
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) return console.error('.env.local에 ANTHROPIC_API_KEY가 없어요');

  const cols = 'id, name, category, tags, genres, min_players, max_players, solo_playable, has_online_coop, has_local_coop, has_pvp, server_type, story_length, difficulty, activities, description, heat_rank, current_players';
  const probe = await supabase.from('games').select('fun_description_at').limit(1);
  if (probe.error) {
    hasMarker = false;
    console.log('⚠️  games.fun_description_at 칸이 없어 처리 기록을 남기지 못해요 (비워 둔 게임은 다음 주에 다시 시도). 추가 SQL은 파일 위 주석 참고\n');
  }

  let games = [];
  if (IDS) {
    // id가 많으면 주소가 길어지므로 100개씩 나눠 조회
    for (let i = 0; i < IDS.length; i += 100) {
      const { data, error } = await supabase.from('games').select(cols).in('id', IDS.slice(i, i + 100));
      if (error) return console.error('조회 실패:', error.message);
      games.push(...data);
    }
  } else {
    let query = supabase.from('games').select(cols);
    query = query.is('fun_description', null);
    if (hasMarker) query = query.is('fun_description_at', null);
    query = query
      .order('heat_rank', { ascending: true, nullsFirst: false })
      .order('current_players', { ascending: false, nullsFirst: false })
      .limit(LIMIT);
    const { data, error } = await query;
    if (error) return console.error('조회 실패:', error.message);
    games = data;
  }

  console.log(`한 줄 소개 ${games.length}개 작성${DRY_RUN ? ' (미리보기 — DB 저장 안 함)' : ''} · 예상 약 $${(games.length * 0.003).toFixed(3)} (다시 쓰기 포함 최대 $${(games.length * 0.006).toFixed(3)})\n`);
  const result = { saved: 0, rejected: 0, empty: 0, failed: 0 };
  for (const g of games) {
    try {
      // 후보 3개 중 검사를 통과한 가장 좋은 것을 고름. 셋 다 걸리면 이유를 알려 주고 한 번만 다시 받음 (게임당 최대 2번 호출)
      let best = pick(parseCandidates(await write(g)), g);
      if (best?.problems.length) {
        console.log(`   ↻ ${g.name} 후보 3개 모두 탈락, 다시 씀 (${whyList(best.problems)}): ${best.line}`);
        best = pick(parseCandidates(await write(g, best)), g);
      }
      const line = best?.line ?? null;
      const problems = best?.problems ?? [];
      if (isEmpty(line)) {
        result.empty++;
        console.log(`⬜ ${g.name} — 확신이 없어 비워 둠`);
        await markDone(g.id, null);
      } else {
        if (problems.length) {
          result.rejected++;
          console.log(`🚫 ${g.name} — 검사 탈락 (${whyList(problems)}), 저장 안 함\n    ${line}`);
          await markDone(g.id, null);
        } else {
          result.saved++;
          console.log(`✍️  ${g.name} (${line.length}자)\n    ${line}`);
          await markDone(g.id, line);
        }
      }
    } catch (e) {
      result.failed++;
      console.log(`❌ ${g.name}: ${e.message}`);
    }
    await sleep(400);
  }
  const cost = usage.input * PRICE_IN + usage.output * PRICE_OUT;
  console.log(`\n완료 — 통과 ${result.saved} · 검사 탈락 ${result.rejected} · 비워 둠 ${result.empty} · 오류 ${result.failed}`
    + ` · 토큰 입력 ${usage.input} / 출력 ${usage.output} · 약 $${cost.toFixed(4)}${DRY_RUN ? ' (DB 저장 안 함)' : ''}`);
}

main();
