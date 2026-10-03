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

// 협동(여럿이 같이 하는) 영상인지 — 제목이나 설명에 이 단어가 있어야 "친구랑 하는 영상"으로 고른다
// "개같이"(비속어 강조)는 제외, "11명이", "4인" 같은 인원 표현은 포함
export const COOP_WORDS = /합방|멀티|(?<!개)같이|친구|협동|듀오|스쿼드|트리오|\d+\s*인(?![가-힣])|\d+\s*명(이서|이|에서)|다같이|함께|코옵|co-?op/i;
export const isCoopVideo = (text) => COOP_WORDS.test(String(text || ''));

// search_name_ko는 쉼표로 여러 이름을 넣을 수 있음 (예: "파스모포비아, 파즈모포비아")
export const koNames = (value) => String(value || '').split(',').map((s) => s.replace(/[™®©]/g, '').replace(/\s+/g, ' ').trim()).filter(Boolean);
