// scripts/verify-server-type.mjs
// 서버 방식(server_type)이 빈 멀티 게임을 Haiku + 웹 검색으로 확인해서 채우기
// - 기준: 혼자 하는 모드를 인터넷 없이 할 수 있으면 '온라인 + 오프라인', 혼자여도 접속이 필요하면 '상시 온라인',
//         인터넷 멀티가 아예 없으면 '오프라인 전용'. 확인이 안 되면 비워 둠
// - 이미 값이 있는 칸은 덮어쓰지 않고, 한 번 확인한 게임은 scripts/.cache/server-type-checked.json에 남겨 다시 부르지 않음
// - Haiku 판단이 틀릴 때가 있음 (첫 실행 15개 중 4개는 근거가 약하거나 틀려서 사람이 고침) → 출력의 근거·URL을 꼭 훑어볼 것
// - 스팀 외 게임은 협동·대전 칸 실제 지원 여부도 받아서 DB와 다르면 목록으로만 보여줌 (고치는 건 사람이 판단)
// 실행: node --env-file=.env.local scripts/verify-server-type.mjs [--ids <파일>]   (게임당 약 0.04달러)
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { onlyIds } from './lib/only-ids.mjs';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const CACHE = 'scripts/.cache/server-type-checked.json';
const SERVER = ['상시 온라인', '온라인 + 오프라인', '오프라인 전용'];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const PROMPT = (g) => `PC 게임 "${g.name}"${g.steam_appid ? ` (Steam appid ${g.steam_appid})` : ''}의 인터넷 필요 여부를 웹 검색으로 확인해서 JSON으로만 답해.
공식 사이트, 스토어 페이지, 공식 FAQ, 개발자 답변을 우선 참고하고, 확인이 안 되면 추측하지 말고 null.

{
  "server_type": "상시 온라인" | "온라인 + 오프라인" | "오프라인 전용" | null,
    // 혼자 하는 모드를 인터넷 연결 없이 할 수 있고 온라인 멀티도 있으면 "온라인 + 오프라인"
    // 혼자 해도 인터넷 접속이 필요하면 "상시 온라인"
    // 인터넷 멀티가 아예 없으면 "오프라인 전용"
  "online_coop": true | false | null,   // 인터넷으로 같이 하는 협동이 있는지
  "local_coop": true | false | null,    // 한 화면/한 PC 협동이 있는지
  "pvp": true | false | null,           // 대전(온라인 또는 로컬)이 있는지
  "evidence": "판단 근거 한 줄 (한국어)",
  "source": "근거 URL 하나"
}

JSON 외의 설명, 코드블록은 쓰지 마.`;

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
      max_tokens: 800,
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }],
      messages: [{ role: 'user', content: PROMPT(g) }],
    }),
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  const text = (json.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n');
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('JSON 응답 없음');
  return JSON.parse(text.slice(start, end + 1).replace(/\/\/[^\n"]*$/gm, ''));
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) return console.error('.env.local에 ANTHROPIC_API_KEY가 없어요');
  const cache = fs.existsSync(CACHE) ? JSON.parse(fs.readFileSync(CACHE, 'utf8')) : {};
  const save = () => { fs.mkdirSync('scripts/.cache', { recursive: true }); fs.writeFileSync(CACHE, JSON.stringify(cache, null, 2)); };

  const { data, error } = await onlyIds(supabase
    .from('games')
    .select('id, name, source, steam_appid, has_online_coop, has_local_coop, has_pvp')
    .eq('hidden', false)
    .is('server_type', null)
    .or('has_online_coop.eq.true,has_pvp.eq.true,multiplayer_host.not.is.null'));
  if (error) return console.error('조회 실패:', error.message);
  const games = data.filter((g) => !cache[g.id]);
  console.log(`서버 방식이 빈 멀티 게임 ${games.length}개 확인 (약 ${(games.length * 0.04).toFixed(2)}달러)\n`);

  const unknown = [];
  const flagDiff = [];
  for (const g of games) {
    let ai;
    try { ai = await ask(g); } catch (e) { console.log(`❌ ${g.name}: ${e.message}`); continue; }
    cache[g.id] = { name: g.name, ...ai, checked_at: new Date().toISOString() };
    save();

    if (SERVER.includes(ai.server_type)) {
      const { error: e } = await supabase.from('games').update({ server_type: ai.server_type }).eq('id', g.id).is('server_type', null);
      console.log(`${e ? '❌' : '✅'} ${g.name}: ${ai.server_type} — ${ai.evidence || ''}\n   ${ai.source || ''}`);
    } else {
      unknown.push(g.name);
      console.log(`➖ ${g.name}: 확인 안 됨 — ${ai.evidence || ''}`);
    }
    if (!g.steam_appid) {
      const pairs = [['online_coop', 'has_online_coop'], ['local_coop', 'has_local_coop'], ['pvp', 'has_pvp']];
      const diff = pairs.filter(([a, b]) => typeof ai[a] === 'boolean' && ai[a] !== g[b]).map(([a, b]) => `${b}: ${g[b]} → ${ai[a]}`);
      if (diff.length) flagDiff.push(`${g.name} — ${diff.join(', ')}`);
    }
    await sleep(2000);
  }

  if (unknown.length) console.log(`\n## 확인 안 된 게임 (비워 둠)\n${unknown.map((n) => `- ${n}`).join('\n')}`);
  if (flagDiff.length) console.log(`\n## 협동·대전 칸이 웹 확인과 다른 스팀 외 게임 (직접 확인)\n${flagDiff.map((n) => `- ${n}`).join('\n')}`);
}

main();
