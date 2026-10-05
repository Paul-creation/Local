// scripts/fill-game-details.mjs
// "더 자세히" 정보(엔딩 유무, 서버 방식, 멀티 방식, 가능한 활동)를 Haiku로 채우기 — 웹 검색 없음, 모르면 비워둠
// 이미 있는 값은 덮어쓰지 않고, 한 번 확인한 게임은 다시 부르지 않음(details_ai_at)
import { createClient } from '@supabase/supabase-js';
import { onlyIds } from './lib/only-ids.mjs';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const SERVER = ['상시 온라인', '온라인 + 오프라인', '오프라인 전용']; // 인터넷 필요 여부 (DB 제약과 같음)
const HOST = ['전용 서버', 'P2P']; // 멀티 호스팅 방식 (multiplayer_host)

const yn = (v) => (v == null ? '?' : v ? '있음' : '없음');
const PROMPT = (g) => `게임 "${g.name}"에 대해 아래 정보와 널리 알려진 사실만으로 판단해서 JSON으로만 답해.
확실하지 않은 항목은 반드시 null. 추측해서 채우지 마.

[게임 정보]
인원: ${g.min_players ?? '?'}-${g.max_players ?? '?'}인 / 혼자 플레이: ${g.solo_playable ? '가능' : '친구 필요'}
스팀 분류: 온라인 협동 ${yn(g.has_online_coop)} / 로컬 협동 ${yn(g.has_local_coop)} / 대전 ${yn(g.has_pvp)}
태그: ${(g.tags || []).join(', ')}
설명: ${String(g.description || '').replace(/\s+/g, ' ').slice(0, 300)}

{
  "has_ending": true | false | null,      // 스토리 엔딩(클리어)이 있는지. 라이브 서비스·대전 게임은 false
  "ending_note": "엔딩 관련 한 줄" | null,
  "server_type": ${SERVER.map((s) => `"${s}"`).join(' | ')} | null,   // 인터넷 필요 여부. "상시 온라인"은 혼자 해도 접속 필요, "오프라인 전용"은 인터넷 멀티가 전혀 없을 때만, 혼자 오프라인으로도 되고 온라인 멀티도 있으면 "온라인 + 오프라인"
  "multiplayer_host": ${HOST.map((s) => `"${s}"`).join(' | ')} | null,   // 온라인 멀티 연결 방식. 회사 서버면 "전용 서버", 방장 컴퓨터로 연결하면 "P2P". 온라인 멀티가 없으면 null
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
      max_tokens: 350,
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
  // 온라인 협동이 있는 게임에 '오프라인 전용'은 저장하지 않음 (Baldur's Gate 3 등 오류 방지)
  const offlineConflict = ai.server_type === '오프라인 전용' && g.has_online_coop;
  if (!g.server_type && SERVER.includes(ai.server_type) && !offlineConflict) u.server_type = ai.server_type;
  if (!g.multiplayer_host && HOST.includes(ai.multiplayer_host) && (g.has_online_coop || g.has_pvp)) u.multiplayer_host = ai.multiplayer_host;
  if (!(g.activities?.length) && Array.isArray(ai.activities)) {
    const acts = ai.activities.filter((a) => typeof a === 'string' && a.trim()).map((a) => a.trim().slice(0, 12)).slice(0, 5);
    if (acts.length) u.activities = acts;
  }
  await supabase.from('games').update(u).eq('id', g.id);
  const got = Object.keys(u).filter((k) => k !== 'details_ai_at');
  console.log(`${got.length ? '✅' : '➖'} ${g.name}${got.length ? ' — ' + [
    u.has_ending != null ? `엔딩 ${u.has_ending ? '있음' : '없음'}` : '',
    u.server_type || '',
    u.multiplayer_host || '',
    u.activities ? u.activities.join(', ') : '',
  ].filter(Boolean).join(' | ') : ' (확실한 정보 없음)'}`);
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) return console.error('.env.local에 ANTHROPIC_API_KEY가 없어요');
  const { data, error } = await onlyIds(supabase
    .from('games')
    .select('id, name, tags, description, min_players, max_players, solo_playable, has_online_coop, has_local_coop, has_pvp, has_ending, ending_note, server_type, multiplayer_host, activities').eq('hidden', false)
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
