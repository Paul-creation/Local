// scripts/fill-game-details.mjs
// "더 자세히" 정보(엔딩 유무, 서버 방식, 가능한 활동)를 Haiku로 채우기 — 웹 검색 없음, 모르면 비워둠
// 이미 있는 값은 덮어쓰지 않고, 한 번 확인한 게임은 다시 부르지 않음(details_ai_at)
import { createClient } from '@supabase/supabase-js';
import { onlyIds } from './lib/only-ids.mjs';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const SERVER = ['전용 서버', 'P2P', '오프라인 전용', '온라인 + 오프라인'];

const PROMPT = (g) => `게임 "${g.name}"에 대해 아래 정보와 널리 알려진 사실만으로 판단해서 JSON으로만 답해.
확실하지 않은 항목은 반드시 null. 추측해서 채우지 마.

[게임 정보]
인원: ${g.min_players ?? '?'}-${g.max_players ?? '?'}인 / 혼자 플레이: ${g.solo_playable ? '가능' : '친구 필요'}
태그: ${(g.tags || []).join(', ')}
설명: ${String(g.description || '').replace(/\s+/g, ' ').slice(0, 300)}

{
  "has_ending": true | false | null,      // 스토리 엔딩(클리어)이 있는지. 라이브 서비스·대전 게임은 false
  "ending_note": "엔딩 관련 한 줄" | null,
  "server_type": ${SERVER.map((s) => `"${s}"`).join(' | ')} | null,
  "activities": ["친구와 할 수 있는 활동 3~5개, 각 2~8글자 한국어"] | null
}`;

async function ask(g) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      messages: [{ role: 'user', content: PROMPT(g) }],
    }),
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  const text = (json.content || []).map((c) => c.text || '').join('');
  return JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
}

async function handle(g) {
  const ai = await ask(g);
  const u = { details_ai_at: new Date().toISOString() };
  if (g.has_ending == null && typeof ai.has_ending === 'boolean') u.has_ending = ai.has_ending;
  if (!g.ending_note && typeof ai.ending_note === 'string' && ai.ending_note.trim()) u.ending_note = ai.ending_note.trim().slice(0, 80);
  if (!g.server_type && SERVER.includes(ai.server_type)) u.server_type = ai.server_type;
  if (!(g.activities?.length) && Array.isArray(ai.activities)) {
    const acts = ai.activities.filter((a) => typeof a === 'string' && a.trim()).map((a) => a.trim().slice(0, 12)).slice(0, 5);
    if (acts.length) u.activities = acts;
  }
  await supabase.from('games').update(u).eq('id', g.id);
  const got = Object.keys(u).filter((k) => k !== 'details_ai_at');
  console.log(`${got.length ? '✅' : '➖'} ${g.name}${got.length ? ' — ' + [
    u.has_ending != null ? `엔딩 ${u.has_ending ? '있음' : '없음'}` : '',
    u.server_type || '',
    u.activities ? u.activities.join(', ') : '',
  ].filter(Boolean).join(' | ') : ' (확실한 정보 없음)'}`);
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) return console.error('.env.local에 ANTHROPIC_API_KEY가 없어요');
  const { data, error } = await onlyIds(supabase
    .from('games')
    .select('id, name, tags, description, min_players, max_players, solo_playable, has_ending, ending_note, server_type, activities')
    .is('details_ai_at', null));
  if (error) return console.error('조회 실패:', error.message);

  const games = data.filter((g) => g.has_ending == null || !g.server_type || !(g.activities?.length));
  console.log(`빈칸 있는 게임 ${games.length}개 (약 ${Math.ceil(games.length * 0.12)}센트)\n`);

  for (let i = 0; i < games.length; i += 4) {
    await Promise.all(games.slice(i, i + 4).map((g) => handle(g).catch((e) => console.log(`❌ ${g.name}: ${e.message}`))));
  }
  console.log('\n완료');
}

main();
