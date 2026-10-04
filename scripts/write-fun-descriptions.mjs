// scripts/write-fun-descriptions.mjs
// 게임에 "한 줄 소개"를 써서 fun_description에 저장 — 원래 설명(description)은 그대로 둠
// 기준은 data/intros/top100.json(인기 100개 소개)과 같음: 40~60자 담백한 설명체, 친구랑 할 때 어떤 게임인지 먼저
// 실행: node --env-file=.env.local scripts/write-fun-descriptions.mjs              (기본 20개, 소개가 빈 게임만)
//       node --env-file=.env.local scripts/write-fun-descriptions.mjs 50           (개수 지정)
//       node --env-file=.env.local scripts/write-fun-descriptions.mjs --ids <id>,<id>   (지정한 게임만, 이미 있어도 다시 씀)
//       --dry-run 을 붙이면 생성만 하고 DB에는 아무것도 쓰지 않음
// - 생성 뒤 검사(checkLine): 40~60자, 금지어(과장·예전 퀘스트 말투·인원/가격 숫자 등), 멀티 없는 게임은 "혼자", 협동 게임은 "친구"
//   어긋나면 저장하지 않고 로그만 남김. AI가 확신이 없다고 답하면(없음) 비워 둠
// - 한 번 처리한 게임은 fun_description_at에 시각을 남겨 다시 부르지 않음 (검사 탈락·비워 둔 게임 포함, API 오류는 다음에 재시도)
//   칸이 아직 없으면 경고만 하고 소개가 빈 게임을 대상으로 그대로 진행
//   추가 SQL: alter table games add column if not exists fun_description_at timestamptz;
// - AI 호출: Haiku, 게임당 1번 (검사에 걸리면 이유를 알려 주고 1번 더) (scripts/는 CLAUDE.md 규칙상 guardedClaudeFetch 예외 — 사이트 하루 AI 상한을 쓰지 않도록 직접 호출)
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
const IDS = process.argv.includes('--ids') ? process.argv[process.argv.indexOf('--ids') + 1].split(',') : null;
const DRY_RUN = process.argv.includes('--dry-run');
const LIMIT = (!IDS && Number(process.argv[2])) || 20;
const MODEL = 'claude-haiku-4-5-20251001';
const PRICE_IN = 1 / 1e6; // 달러/토큰 (Haiku 4.5 입력 $1/MTok)
const PRICE_OUT = 5 / 1e6; // 출력 $5/MTok
const MIN_LEN = 40;
const MAX_LEN = 60;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 예시 5개는 data/intros/top100.json에서 골랐다 (협동·대전·혼자 기본+협동·멀티 없음·파티 추리)
const STYLE = `너는 게임 추천 사이트의 한 줄 소개를 쓴다. 읽는 사람은 "친구랑 뭐 하지?"를 고르는 중이다.

규칙:
- 공백 포함 40~60자 (넘기 쉬우니 50자 안팎을 목표로), 한두 문장. 담백한 설명체(~다, ~한다)로 쓴다. 명령형(~하라)이나 광고 말투는 쓰지 않는다
- 앞부분에서 친구랑 할 때 어떤 게임인지 알려 준다: 협동인지 대전인지 혼자 하는지, 같이 하는 방식, 한 판 길이, 분위기 중 맞는 것
- 멀티가 없는 게임은 혼자 즐기는 게임이라는 게 드러나게 쓴다 ("혼자"라는 말을 넣는다)
- 협동 게임은 "친구와 ~"처럼 친구와 함께 한다는 게 분명히 드러나게 쓴다
- 문장 모양을 다양하게 쓴다. "~게임으로, ~한다" 같은 틀을 반복하지 않는다
- 과장("역대급", "최고의", "인생 게임" 등), 스포일러(결말·반전·흑막)는 쓰지 않는다
- 인원 수(예: 4인, 8명)와 가격은 화면에 따로 나오므로 숫자로 쓰지 않는다
- 아래 [게임 정보]에 있는 사실만 쓴다. 캐릭터·지명·기능을 지어내지 않는다
- 정보가 부족하거나 어떤 게임인지 확신이 없으면 소개 대신 "없음"이라고만 답한다
- 따옴표, 이모지, 해시태그 없이 소개 문장만 출력한다

좋은 예시:
- Lethal Company (온라인 협동 호러): 친구와 버려진 행성에서 고철을 모아 할당량을 채우는 협동 호러. 가까운 목소리만 들려 비명이 웃음이 된다.
- Rocket League (온라인 팀 대전): 자동차로 공을 차 넣는 팀 대전 게임. 한 경기가 5분이라 친구와 짧게 여러 판 돌리기 좋다.
- ELDEN RING (기본 혼자, 소환 협동): 기본은 혼자 탐험하는 고난도 액션 RPG. 막히는 보스는 친구를 소환해 함께 잡을 수 있다.
- Cities: Skylines (멀티 없음): 멀티 없이 혼자 도로, 구역, 교통을 설계하는 도시 건설 시뮬레이션. 끝없이 확장하며 오래 붙잡는다.
- Among Us (온라인 파티 추리): 친구들 사이에 숨은 임포스터를 토론과 투표로 찾아내는 추리 게임. 한 판이 10분 안팎으로 짧다.`;

// 생성 뒤 검사에 쓰는 금지 표현 (과장·예전 퀘스트 말투·인원/가격 숫자·꾸밈 문자)
const BANNED = [
  [/역대급|최고의|최강|갓겜|인생\s?게임|끝판왕|압도적|전설적|혁명적|완벽한|미친/, '과장 표현'],
  [/(하라|어라|아라|여라|져라|워라)[.!]?(\s|$)/, '명령형(예전 퀘스트 말투)'],
  [/\d+\s*(인|명)(?!칭)|\d+\s*~\s*\d+\s*인|\d+\s*대\s*\d+/, '인원 숫자'],
  [/₩|\d[\d,]*\s*원|\$\s*\d|무료|할인/, '가격'],
  [/["“”#]|[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u, '따옴표·해시태그·이모지'],
  [/결말|반전|흑막|스포/, '스포일러 우려'],
  [/^[^.]{0,40}게임으로,/, '"~게임으로, ~" 틀'],
];

// "없음" 또는 "없음 (이유…)"이면 확신이 없어 비워 둔 것
const isEmpty = (line) => !line || /^없음/.test(line);
const hasCoop = (g) => !!(g.has_online_coop || g.has_local_coop);
const noMulti = (g) => g.max_players === 1 || (!hasCoop(g) && !g.has_pvp && (g.max_players ?? 1) <= 1);

// 검사에 걸리면 이유 목록을, 통과하면 빈 배열을 돌려준다
function checkLine(line, game) {
  const problems = [];
  if (line.length < MIN_LEN || line.length > MAX_LEN) problems.push(`길이 ${line.length}자`);
  for (const [re, why] of BANNED) if (re.test(line)) problems.push(why);
  if (noMulti(game) && !line.includes('혼자')) problems.push('멀티 없는 게임인데 "혼자"가 없음');
  if (hasCoop(game) && !line.includes('친구')) problems.push('협동 게임인데 "친구"가 없음');
  return problems;
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
      max_tokens: 200,
      system: STYLE,
      messages: [
        { role: 'user', content: `[게임 정보]\n${gameInfo(game)}` },
        ...(feedback ? [
          { role: 'assistant', content: feedback.line },
          { role: 'user', content: `검사에 걸렸어: ${feedback.problems.join(', ')}. 규칙에 맞게 다시 써 (공백 포함 ${MIN_LEN}~${MAX_LEN}자). 소개 문장만 출력해.` },
        ] : []),
      ],
    }),
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  usage.input += json.usage?.input_tokens || 0;
  usage.output += json.usage?.output_tokens || 0;
  return (json.content || []).map((c) => c.text || '').join('').replace(/\s+/g, ' ').trim();
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

  let query = supabase.from('games').select(cols);
  if (IDS) query = query.in('id', IDS);
  else {
    query = query.is('fun_description', null);
    if (hasMarker) query = query.is('fun_description_at', null);
    query = query
      .order('heat_rank', { ascending: true, nullsFirst: false })
      .order('current_players', { ascending: false, nullsFirst: false })
      .limit(LIMIT);
  }
  const { data: games, error } = await query;
  if (error) return console.error('조회 실패:', error.message);

  console.log(`한 줄 소개 ${games.length}개 작성${DRY_RUN ? ' (미리보기 — DB 저장 안 함)' : ''} · 예상 약 $${(games.length * 0.002).toFixed(3)} (다시 쓰기 포함 최대 $${(games.length * 0.005).toFixed(3)})\n`);
  const result = { saved: 0, rejected: 0, empty: 0, failed: 0 };
  for (const g of games) {
    try {
      let line = await write(g);
      // 검사에 걸리면 이유를 알려 주고 한 번만 다시 씀 (게임당 최대 2번 호출)
      let problems = isEmpty(line) ? [] : checkLine(line, g);
      if (problems.length) {
        console.log(`   ↻ ${g.name} 다시 씀 (${problems.join(', ')}): ${line}`);
        line = await write(g, { line, problems });
        problems = isEmpty(line) ? [] : checkLine(line, g);
      }
      if (isEmpty(line)) {
        result.empty++;
        console.log(`⬜ ${g.name} — 확신이 없어 비워 둠`);
        await markDone(g.id, null);
      } else {
        if (problems.length) {
          result.rejected++;
          console.log(`🚫 ${g.name} — 검사 탈락 (${problems.join(', ')}), 저장 안 함\n    ${line}`);
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
