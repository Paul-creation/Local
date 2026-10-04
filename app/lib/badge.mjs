// 상세 페이지 배지(games.category)를 인원·협동/대전 칸에서 계산하는 순수 함수
// — 사이트(관리자 저장·검색 필터)와 scripts(수집·검증·scripts/sync-categories.mjs)가 같이 씀
// - max_players가 1 → '혼자'
// - 협동(has_online_coop 또는 has_local_coop)과 대전(has_pvp) → '협동' · '대전' · 둘 다면 '협동·대전'
// - 멀티인데 칸이 비었거나 모두 false면 종류를 모르므로 null (배지 안 보임)

export const BADGES = ['혼자', '협동', '대전', '협동·대전'];

/** @param {{ max_players?: number | null, has_online_coop?: boolean | null, has_local_coop?: boolean | null, has_pvp?: boolean | null }} g */
export function badgeFor(g) {
  if (g.max_players === 1) return '혼자';
  const coop = g.has_online_coop === true || g.has_local_coop === true;
  const pvp = g.has_pvp === true;
  if (coop && pvp) return '협동·대전';
  if (coop) return '협동';
  if (pvp) return '대전';
  return null;
}

// 배지 색: 협동은 파랑, 대전은 빨강, 둘 다면 둘을 섞은 보라 (app/globals.css .badge-neutral.is-*)
/** @param {string | null | undefined} category */
export function badgeClass(category) {
  return { '협동': 'is-coop', '대전': 'is-pvp', '협동·대전': 'is-both' }[category ?? ''] ?? '';
}

// 검색 필터: '협동'·'대전'을 고르면 '협동·대전' 게임도 나오게
/** @param {string | null | undefined} category @param {string} selected */
export function badgeMatches(category, selected) {
  if (!category) return false;
  if (selected === '협동' || selected === '대전') return category.split('·').includes(selected);
  return category === selected;
}
