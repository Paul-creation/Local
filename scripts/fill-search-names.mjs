// scripts/fill-search-names.mjs
// "친구랑 하는 영상" 대상 게임에 한국 유저가 실제로 부르는 이름(예: 리썰 컴퍼니, 어몽어스, 레데리2)을 search_name_ko에 저장
// 실행: node --env-file=.env.local scripts/fill-search-names.mjs
// - search_name_ko가 비어 있는 게임만 처리 (이미 있는 값은 덮어쓰지 않음)
// - 이름이 이미 한국어면 AI 없이 그대로 저장
// - 대상 전체를 Haiku 한 번에 물어봄 (50개 기준 약 1센트)
import { createClient } from '@supabase/supabase-js';
import { getCoopTargets } from './lib/coop-targets.mjs';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function askKoreanNames(games) {
  const list = games.map((g, i) => `${i + 1}. ${g.name}`).join('\n');
  const prompt = `아래 게임들을 한국 유저들이 유튜브 검색할 때 실제로 부르는 이름으로 알려줘.
- 한국에서 흔히 쓰는 한글 이름 (예: Lethal Company → 리썰 컴퍼니, Among Us → 어몽어스, Red Dead Redemption 2 → 레데리2)
- 줄임말이 더 흔하면 줄임말, 아니면 정식 한글 이름
- 한국에서도 영어 이름 그대로 부르면 그 영어 이름 (™ ® 같은 기호는 빼고)
- 에디션 이름(Complete Edition, GOTY 등)은 빼

게임 목록:
${list}

번호 순서대로 JSON으로만 답해. 설명이나 코드블록은 쓰지 마.
{"names": [{"index": 1, "name": "리썰 컴퍼니"}]}`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  const json = await res.json();
  if (json.error) throw new Error(`HTTP ${res.status} ${json.error.message}`);
  const text = (json.content || []).map((c) => c.text || '').join('');
  const parsed = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
  const u = json.usage || {};
  console.log(`Haiku 사용: 입력 ${u.input_tokens} · 출력 ${u.output_tokens} 토큰 (약 $${((u.input_tokens || 0) / 1e6 + (u.output_tokens || 0) * 5 / 1e6).toFixed(4)})\n`);
  return games.map((g, i) => String(parsed.names?.find((n) => Number(n.index) === i + 1)?.name || '').trim());
}

async function main() {
  const targets = await getCoopTargets(supabase, 'search_name_ko');
  const todo = targets.filter((g) => !g.search_name_ko);
  console.log(`대상 ${targets.length}개 중 한국어 이름이 없는 게임 ${todo.length}개 처리\n`);
  if (!todo.length) return;

  const korean = todo.filter((g) => /[가-힣]/.test(g.name));
  const others = todo.filter((g) => !/[가-힣]/.test(g.name));
  const updates = korean.map((g) => ({ g, name: g.name }));
  if (others.length) {
    if (!process.env.ANTHROPIC_API_KEY) return console.error('.env.local에 ANTHROPIC_API_KEY가 없어요');
    const names = await askKoreanNames(others);
    others.forEach((g, i) => { if (names[i]) updates.push({ g, name: names[i] }); });
  }

  let saved = 0;
  for (const { g, name } of updates) {
    const { error } = await supabase.from('games').update({ search_name_ko: name }).eq('id', g.id).is('search_name_ko', null);
    if (error) { console.log(`❌ ${g.name}: ${error.message}`); continue; }
    saved++;
    console.log(`✅ ${g.name} → ${name}`);
  }
  console.log(`\n완료 — 저장 ${saved}개 · 이름 못 받음 ${todo.length - updates.length}개`);
}

main().catch((e) => { console.error(`❌ ${e.message}`); process.exit(1); });
