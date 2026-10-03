// scripts/snapshot-hot-rank.mjs
// 메인 "지금 뜨는 게임" 순위(heat_rank 순, 기존 인기 급상승 기준 그대로) 상위 50개를 오늘 날짜(한국 시간)로 hot_rank_history에 저장
// 실행: node --env-file=.env.local scripts/snapshot-hot-rank.mjs
// - 같은 날 다시 돌리면 오늘 기록만 새 순위로 덮어씀 (다른 날짜 기록은 건드리지 않음)
// - enrich-itad-heat(heat_rank 갱신) 뒤에 돌아야 해서 daily 맨 끝에 둠
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const TOP_N = 50;

async function main() {
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date()); // YYYY-MM-DD
  const { data: games, error } = await supabase
    .from('games')
    .select('id, name, heat_rank, current_players')
    .not('heat_rank', 'is', null)
    .order('heat_rank', { ascending: true })
    .limit(TOP_N);
  if (error) return console.error(`❌ 게임 목록을 못 불러옴: ${error.message}`);
  if (!games.length) return console.log('heat_rank가 있는 게임이 없어서 기록하지 않음');

  const rows = games.map((g, i) => ({ snapshot_date: today, game_id: g.id, rank: i + 1, current_players: g.current_players ?? null }));
  const { error: upsertError } = await supabase.from('hot_rank_history').upsert(rows, { onConflict: 'snapshot_date,game_id' });
  if (upsertError) return console.error(`❌ 저장 실패: ${upsertError.message}`);

  // 같은 날 다시 돌렸을 때, 오늘 순위에서 빠진 게임의 "오늘" 기록만 정리 (덮어쓰기)
  const { error: cleanError, count } = await supabase
    .from('hot_rank_history')
    .delete({ count: 'exact' })
    .eq('snapshot_date', today)
    .not('game_id', 'in', `(${games.map((g) => g.id).join(',')})`);
  if (cleanError) console.log(`⚠️ 오늘 기록 정리 실패: ${cleanError.message}`);

  console.log(`✅ ${today} 순위 ${rows.length}개 저장${count ? ` (오늘 순위에서 빠진 ${count}개 정리)` : ''}`);
  console.log(games.slice(0, 10).map((g, i) => `  ${i + 1}. ${g.name}`).join('\n'));
}

main();
