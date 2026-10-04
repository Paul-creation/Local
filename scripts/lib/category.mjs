// scripts/lib/category.mjs — 인원이나 협동/대전 칸을 바꾼 뒤 배지(games.category)를 다시 계산해 저장
// - 계산은 app/lib/badge.mjs의 badgeFor (사이트와 같은 기준)
// - 값이 같으면 저장하지 않음. 읽은 뒤 그사이 category가 바뀌었으면 건드리지 않음
import { badgeFor } from '../../app/lib/badge.mjs';

export async function refreshCategory(supabase, id) {
  const { data: g, error } = await supabase
    .from('games')
    .select('category, max_players, has_online_coop, has_local_coop, has_pvp')
    .eq('id', id)
    .single();
  if (error || !g) return null;
  const next = badgeFor(g);
  if (next === g.category) return null;
  let q = supabase.from('games').update({ category: next }).eq('id', id);
  q = g.category == null ? q.is('category', null) : q.eq('category', g.category);
  const { error: e } = await q;
  if (e) { console.log(`   ⚠️ 배지 저장 실패 (${id}): ${e.message}`); return null; }
  return { from: g.category, to: next };
}
