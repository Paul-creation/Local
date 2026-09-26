// scripts/enrich-ai-other.mjs
// 스팀 외 게임의 한국어 지원·사양·용량·출시일·게임 특징을 Claude + 웹 검색으로 채우기
// 실행: node --env-file=.env.local scripts/enrich-ai-other.mjs   (--force: 이미 채운 게임도 다시)
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const FORCE = process.argv.includes('--force');

const PROMPT = (name, store) => `게임 "${name}" (${store} 플랫폼, PC 버전)의 정보를 웹 검색으로 확인해서 JSON으로만 답해.
공식 사이트, 공식 지원 페이지, 스토어 페이지를 우선 참고하고, 확인이 안 되는 값은 추측하지 말고 null로 둬.

{
  "description": "한국어 2~3문장. 어떤 게임이고 친구와 어떻게 즐기는지. 광고 문구 말고 담백하게",
  "korean_support": "자막+더빙" | "자막" | "한국어 없음",
  "release_date": "YYYY-MM-DD (PC 정식 출시일)",
  "min_spec": "운영체제: ... / 프로세서: ... / 메모리: ... / 그래픽: ... / 저장 공간: ...",
  "recommended_spec": "위와 같은 형식, 없으면 null",
  "storage_gb": 숫자 (최소 사양의 저장 공간, GB 단위),
  "solo_playable": true | false (혼자서도 제대로 즐길 수 있는지),
  "recommended_players": "예: 2-4인, 5인 파티",
  "server_type": "예: 전용 서버, P2P, 오프라인 가능",
  "has_ending": true | false,
  "ending_note": "엔딩 관련 한 줄 설명 또는 null",
  "story_length": "예: 약 20시간, 엔딩 없음(라이브 서비스)",
  "activities": ["친구와 할 수 있는 활동 3~5개, 각 2~6글자 한국어"],
  "is_esports": true | false (공식 프로 대회가 있는지)
}

JSON 외의 설명, 코드블록, 출처 표기는 절대 쓰지 마.`;

async function askClaude(name, store) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1200,
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 2 }],
      messages: [{ role: 'user', content: PROMPT(name, store) }],
    }),
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);

  const text = (json.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n');
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('JSON 응답 없음');
  return JSON.parse(text.slice(start, end + 1));
}

const STORE_NAME = { epic: 'Epic Games Store', battlenet: 'Battle.net', riot: 'Riot Client' };
const KOREAN = new Set(['자막+더빙', '자막', '한국어 없음']);

function clean(ai, game) {
  const u = {};
  const str = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);

  if (str(ai.description) && (FORCE || !game.description || game.description.length < 80)) u.description = str(ai.description);
  if (KOREAN.has(ai.korean_support)) u.korean_support = ai.korean_support;
  if (/^\d{4}-\d{2}-\d{2}$/.test(ai.release_date || '')) u.release_date = ai.release_date;
  if (str(ai.min_spec)) u.min_spec = str(ai.min_spec);
  if (str(ai.recommended_spec)) u.recommended_spec = str(ai.recommended_spec);
  if (typeof ai.storage_gb === 'number' && ai.storage_gb > 0) u.storage_gb = ai.storage_gb;
  if (typeof ai.solo_playable === 'boolean') u.solo_playable = ai.solo_playable;
  if (str(ai.recommended_players)) u.recommended_players = str(ai.recommended_players);
  if (str(ai.server_type)) u.server_type = str(ai.server_type);
  if (typeof ai.has_ending === 'boolean') u.has_ending = ai.has_ending;
  if (str(ai.ending_note)) u.ending_note = str(ai.ending_note);
  if (str(ai.story_length)) u.story_length = str(ai.story_length);
  if (Array.isArray(ai.activities)) {
    const acts = ai.activities.map(str).filter(Boolean).slice(0, 5);
    if (acts.length) u.activities = acts;
  }
  if (typeof ai.is_esports === 'boolean') u.is_esports = ai.is_esports;

  // --force가 아니면 이미 있는 값은 건드리지 않음
  if (!FORCE) {
    for (const k of Object.keys(u)) {
      if (k !== 'description' && game[k] != null && game[k] !== '') delete u[k];
    }
  }
  return u;
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) return console.error('.env.local에 ANTHROPIC_API_KEY가 없어요');

  const { data: games, error } = await supabase
    .from('games')
    .select('id, name, source, description, korean_support, release_date, min_spec, recommended_spec, storage_gb, solo_playable, recommended_players, server_type, has_ending, ending_note, story_length, activities, is_esports, ai_enriched_at')
    .is('steam_appid', null);
  if (error) return console.error('조회 실패:', error.message);

  const targets = FORCE ? games : games.filter((g) => !g.ai_enriched_at && (!g.korean_support || !g.min_spec || !g.server_type));
  console.log(`스팀 외 게임 ${games.length}개 중 ${targets.length}개 처리\n`);

  for (const game of targets) {
    try {
      const ai = await askClaude(game.name, STORE_NAME[game.source] || 'PC');
      const update = { ...clean(ai, game), ai_enriched_at: new Date().toISOString() };
      if (Object.keys(update).length === 1) {
        await supabase.from('games').update({ ai_enriched_at: update.ai_enriched_at }).eq('id', game.id);
        console.log(`건너뜀 (새 정보 없음): ${game.name}`);
        continue;
      }
      const { error: upErr } = await supabase.from('games').update(update).eq('id', game.id);
      if (upErr) console.error(`❌ 저장 실패 (${game.name}):`, upErr.message);
      else
        console.log(
          `✅ ${game.name} — 한국어 ${update.korean_support ?? game.korean_support ?? '?'} | ` +
          `용량 ${update.storage_gb ?? game.storage_gb ?? '?'}GB | 출시 ${update.release_date ?? game.release_date ?? '?'}`
        );
    } catch (err) {
      console.error(`❌ ${game.name}:`, err.message);
    }
    await sleep(2000);
  }
  console.log('\n완료');
}

main();
