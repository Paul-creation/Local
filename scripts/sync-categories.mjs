// scripts/sync-categories.mjs — 전체 게임의 배지(games.category)를 인원·협동/대전 칸에서 다시 계산 (AI 안 씀, 비용 0)
// 실행: node --env-file=.env.local scripts/sync-categories.mjs           (미리보기 — 바뀔 개수만 출력, DB는 안 건드림)
//       node --env-file=.env.local scripts/sync-categories.mjs --apply   (반영)
// - 계산 기준은 app/lib/badge.mjs의 badgeFor (사이트·다른 스크립트와 같음)
// - 읽은 뒤 그사이 category가 바뀐 게임은 건드리지 않음
import { createClient } from '@supabase/supabase-js';
import { badgeFor } from '../app/lib/badge.mjs';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const APPLY = process.argv.includes('--apply');

const { data, error } = await supabase
  .from('games')
  .select('id, name, category, max_players, has_online_coop, has_local_coop, has_pvp')
  .order('id');
if (error) { console.error('게임 목록을 못 불러옴:', error.message); process.exit(1); }

const changes = data.map((g) => ({ g, to: badgeFor(g) })).filter(({ g, to }) => to !== g.category);
const kinds = {};
for (const { g, to } of changes) {
  const k = `${g.category ?? '(없음)'} → ${to ?? '(없음)'}`;
  kinds[k] = (kinds[k] || 0) + 1;
}
console.log(`${APPLY ? '반영' : '미리보기'} — 게임 ${data.length}개 중 배지가 바뀌는 게임 ${changes.length}개\n`);
for (const [k, n] of Object.entries(kinds).sort((a, b) => b[1] - a[1])) console.log(`  ${k}: ${n}개`);

if (APPLY) {
  let saved = 0, failed = 0;
  for (const { g, to } of changes) {
    let q = supabase.from('games').update({ category: to }).eq('id', g.id);
    q = g.category == null ? q.is('category', null) : q.eq('category', g.category);
    const { data: done, error: e } = await q.select('id');
    if (e || !done?.length) { failed++; console.log(`❌ ${g.name}: ${e?.message || '그사이 값이 바뀌어 건너뜀'}`); } else saved++;
  }
  console.log(`\n완료 — 저장 ${saved}개${failed ? ` · 실패 ${failed}개` : ''}`);
} else {
  console.log('\n미리보기만 했어요. 반영하려면 --apply를 붙여 주세요');
}
