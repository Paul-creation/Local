// scripts/lib/players-pending.mjs — "인원 검증 대기" 목록 만들기 (순수 함수, DB·네트워크 없음)
// 스팀 카테고리로 싱글/멀티 구분: 싱글 전용 / 멀티·협동 있음 / 정보 없음 (enrich-specs와 같은 카테고리 번호가 아니라 영어 이름 기준)
const MULTI = /multi|co-op|pvp|split screen|mmo/i;

// categories: 스팀 영어 카테고리 이름 배열, 정보를 못 받았으면 null
export function steamClass(categories) {
  if (!Array.isArray(categories) || categories.length === 0) return 'none';
  const multi = categories.some((c) => MULTI.test(c));
  const single = categories.includes('Single-player');
  if (single && !multi) return 'single';
  if (multi) return 'multi';
  return 'none';
}

// 인기순(현재 접속자 많은 순, 없으면 뒤로) → 이름순
export function sortPending(rows) {
  return [...rows].sort((a, b) => (b.current_players ?? -1) - (a.current_players ?? -1) || String(a.name).localeCompare(String(b.name)));
}

export function buildRow(game, categories, igdb) {
  return {
    id: game.id,
    name: game.name,
    steam_appid: game.steam_appid ?? null,
    min_players: game.min_players ?? null,
    current_players: game.current_players ?? null,
    heat_rank: game.heat_rank ?? null,
    steam_class: steamClass(categories),
    steam_categories: Array.isArray(categories) ? categories : null,
    igdb_name: igdb?.name ?? null,
    igdb_via: igdb?.via ?? null,
    igdb_max_candidate: igdb?.max ?? null,
  };
}
