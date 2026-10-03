// scripts/write-fun-descriptions.mjs
// 인기 게임에 "한 줄 소개"(퀘스트 문구 느낌의 재미있는 설명) 쓰기 — 원래 설명은 그대로 두고 fun_description에 따로 저장
// 실행: node --env-file=.env.local scripts/write-fun-descriptions.mjs        (기본 20개)
//       node --env-file=.env.local scripts/write-fun-descriptions.mjs 50     (개수 지정)
//       node --env-file=.env.local scripts/write-fun-descriptions.mjs --ids <id>,<id>   (지정한 게임만, 이미 있어도 다시 씀)
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
const IDS = process.argv.includes('--ids') ? process.argv[process.argv.indexOf('--ids') + 1].split(',') : null;
const LIMIT = (!IDS && Number(process.argv[2])) || 20;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const STYLE = `너는 게임 소개 문구 작가야. 해적 게임 퀘스트 문구처럼, 플레이어에게 임무를 건네는 말투로 한국어 한 줄 소개를 써.

규칙:
- 2문장, 공백 포함 90자 이내
- 명령형이나 "~다" 체의 서사적 말투, 살짝 유머러스하게
- 아래 [게임 정보]에 있는 사실만 써. 캐릭터 이름, 지명, 기능을 지어내지 마
- 인원, 친구와 하는 재미가 드러나면 좋아
- 따옴표, 이모지, 해시태그 쓰지 마. 문장만 출력

예시 (친구와 캠핑카를 몰고 산길을 넘는 협동 운전 게임):
친구들을 낡은 캠핑카에 태우고 산을 넘어라. 차가 먼저 부서질지 우정이 먼저 부서질지는 아무도 모른다.`;

async function write(game) {
  const info = [
    `이름: ${game.name}`,
    `인원: ${game.min_players ?? '?'}-${game.max_players ?? '?'}인${game.recommended_players ? ` (추천 ${game.recommended_players})` : ''}`,
    `혼자 플레이: ${game.solo_playable ? '가능' : '친구 필요'}`,
    `난이도: ${game.difficulty || '?'}`,
    `태그: ${(game.tags || []).join(', ')}`,
    game.activities?.length ? `할 수 있는 것: ${game.activities.join(', ')}` : '',
    `공식 설명: ${String(game.description || '').replace(/\s+/g, ' ').slice(0, 300)}`,
  ].filter(Boolean).join('\n');

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      messages: [{ role: 'user', content: `${STYLE}\n\n[게임 정보]\n${info}` }],
    }),
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  return (json.content || []).map((c) => c.text || '').join('').replace(/["“”]/g, '').trim();
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) return console.error('.env.local에 ANTHROPIC_API_KEY가 없어요');

  const cols = 'id, name, tags, min_players, max_players, recommended_players, solo_playable, difficulty, activities, description, heat_rank, current_players';
  const { data: games, error } = IDS
    ? await supabase.from('games').select(cols).in('id', IDS)
    : await supabase
    .from('games')
    .select(cols)
    .is('fun_description', null)
    .order('heat_rank', { ascending: true, nullsFirst: false })
    .order('current_players', { ascending: false, nullsFirst: false })
    .limit(LIMIT);
  if (error) return console.error('조회 실패:', error.message);

  console.log(`인기 게임 ${games.length}개 한 줄 소개 작성 (약 ${(games.length * 0.1).toFixed(1)}센트)\n`);
  for (const g of games) {
    try {
      const line = await write(g);
      if (line.length < 15 || line.length > 140) {
        console.log(`⏭️  길이 이상해서 건너뜀: ${g.name} (${line.length}자)`);
        continue;
      }
      await supabase.from('games').update({ fun_description: line }).eq('id', g.id);
      console.log(`✍️  ${g.name}\n    ${line}\n`);
    } catch (e) {
      console.log(`❌ ${g.name}: ${e.message}`);
    }
    await sleep(400);
  }
  console.log('완료 — 마음에 안 드는 건 Supabase에서 fun_description을 비우고 다시 돌리면 새로 써요');
}

main();
