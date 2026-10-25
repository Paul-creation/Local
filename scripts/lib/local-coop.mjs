// scripts/lib/local-coop.mjs
// 스팀 카테고리 → has_local_coop 판정 (fill-steam-categories가 씀)
// 규칙: "Shared/Split Screen Co-op"이 있거나, 일반 "Shared/Split Screen"이 있고 "Shared/Split Screen PvP"는 없으면 true. 이미 true인 값은 false로 내리지 않음
export function localCoopFromCategories(cats, current = null) {
  if (current === true) return true;
  if (cats.includes('Shared/Split Screen Co-op')) return true;
  return cats.includes('Shared/Split Screen') && !cats.includes('Shared/Split Screen PvP');
}
