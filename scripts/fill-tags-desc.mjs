// scripts/fill-tags-desc.mjs
// 남은 빈칸 마무리: ① 짧은 설명은 스팀 한국어 소개로 교체(무료) ② 태그 1개 이하 게임은 Haiku가 "기존 태그 목록 안에서만" 골라 채움
import { createClient } from '@supabase/supabase-js';
import { ONLY_IDS } from './lib/only-ids.mjs';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function steamKoreanDesc(appid) {
  try {
    const res = await fetch(`https://store.steampowered.com/api/appdetails?appids=${appid}&cc=kr&l=korean`);
    const json = await res.json();
    const d = json?.[appid]?.success ? json[appid].data : null;
    return d?.short_description ? d.short_description.replace(/<[^>]+>/g, '').trim() : null;
  } catch {
    return null;
  }
}

async function pickTags(game, vocab) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 100,
      messages: [{
        role: 'user',
        content: `게임 "${game.name}"에 어울리는 태그 3개를 아래 목록에서만 골라. 목록에 없는 단어는 절대 쓰지 마.
설명: ${(game.description || '').slice(0, 300)}
현재 태그: ${(game.tags || []).join(', ') || '없음'}
태그 목록: ${vocab.join(', ')}
JSON 배열로만 답해. 예: ["호러","온라인 협동","생존"]`,
      }],
    }),
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  const text = (json.content || []).map((c) => c.text || '').join('');
  const arr = JSON.parse(text.slice(text.indexOf('['), text.lastIndexOf(']') + 1));
  return arr.filter((t) => vocab.includes(t));
}

async function main() {
  const { data: games, error } = await supabase
    .from('games')
    .select('id, name, steam_appid, tags, description');
  if (error) return console.error('조회 실패:', error.message);

  // 태그 목록(vocab)은 전체 게임으로 만들고, 채우는 대상만 --ids로 좁힘
  const scope = ONLY_IDS ? games.filter((g) => ONLY_IDS.includes(g.id)) : games;
  const freq = {};
  for (const g of games) for (const t of g.tags || []) freq[t] = (freq[t] || 0) + 1;
  const vocab = Object.keys(freq).filter((t) => freq[t] >= 3).sort((a, b) => freq[b] - freq[a]).slice(0, 150);
  console.log(`태그 후보 ${vocab.length}개\n`);

  for (const g of scope.filter((g) => g.steam_appid && (!g.description || g.description.length < 30))) {
    const desc = await steamKoreanDesc(g.steam_appid);
    if (desc && desc.length > (g.description || '').length && desc.length >= 30) {
      await supabase.from('games').update({ description: desc }).eq('id', g.id);
      g.description = desc;
      console.log(`📝 설명 보강: ${g.name}`);
    } else {
      console.log(`·  설명 그대로 (스팀에도 짧음): ${g.name}`);
    }
    await sleep(1500);
  }

  if (!process.env.ANTHROPIC_API_KEY) return console.log('\nANTHROPIC_API_KEY가 없어서 태그 단계는 건너뜀');
  for (const g of scope.filter((g) => (g.tags || []).length < 2)) {
    try {
      const picked = await pickTags(g, vocab);
      const tags = Array.from(new Set([...(g.tags || []), ...picked])).slice(0, 3);
      if (tags.length > (g.tags || []).length) {
        await supabase.from('games').update({ tags }).eq('id', g.id);
        console.log(`🏷️  ${g.name} — ${tags.join(', ')}`);
      } else {
        console.log(`·  태그 그대로: ${g.name}`);
      }
    } catch (e) {
      console.log(`❌ ${g.name}: ${e.message}`);
    }
    await sleep(500);
  }
  console.log('\n완료');
}

main();
