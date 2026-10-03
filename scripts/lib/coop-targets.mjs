// scripts/lib/coop-targets.mjs
// "친구랑 하는 영상" 대상 게임: max_players 2 이상 중 인기 상위 50개 (heat_rank 순, 없으면 current_players 순)
// fetch-coop-videos, fill-search-names가 같은 기준을 쓰도록 공통으로 둔다
export const COOP_TOP_N = 50;

export async function getCoopTargets(supabase, fields) {
  const { data, error } = await supabase
    .from('games')
    .select(`id, name, heat_rank, current_players, ${fields}`)
    .gte('max_players', 2);
  if (error) throw new Error(`게임 목록을 못 불러옴: ${error.message}`);
  return data
    .filter((g) => g.heat_rank || g.current_players)
    .sort((a, b) => {
      if (a.heat_rank && b.heat_rank) return a.heat_rank - b.heat_rank;
      if (a.heat_rank) return -1;
      if (b.heat_rank) return 1;
      return (b.current_players || 0) - (a.current_players || 0);
    })
    .slice(0, COOP_TOP_N);
}
