// 담당: 친구(검색·태그·비교)
// 고른 필터 조건을 칩 목록으로 — 결과 위 조건 칩, 0개일 때 조건 요약에서 같이 쓴다
// 누르면 그 조건만 해제(clear). 태그(selectedTags)는 검색창 안 칩으로도 보이므로 withTags로 넣을지 고른다
import { NETS, type GameFilters } from './useGameFilters';
import { tagKeyLabel } from './tagSearch';
import { PLAYERS_ALL, PRICE_ALL, FREE_ONLY, isAll, playersLabel, priceLabel, type Range } from './rangeFilter';

export type Condition = { key: string; label: string; clear: () => void };

const rangeText = (r: Range, label: (i: number) => string) => (r[0] === r[1] ? label(r[0]) : `${label(r[0])}~${label(r[1])}`);

export function filterConditions(f: GameFilters, { withTags = true } = {}): Condition[] {
  const out: Condition[] = [];
  if (f.selectedCategory) out.push({ key: 'cat', label: f.selectedCategory, clear: () => f.setSelectedCategory('') });
  if (!isAll(f.playersRange, PLAYERS_ALL)) out.push({ key: 'players', label: `인원 ${rangeText(f.playersRange, playersLabel)}`, clear: () => f.setPlayersRange(PLAYERS_ALL) });
  if (f.soloOnly) out.push({ key: 'solo', label: '1인 전용', clear: () => f.setSoloOnly(false) });
  if (f.storyOnly) out.push({ key: 'story', label: '혼자도 꽉 차게', clear: () => f.setStoryOnly(false) });
  if (isAll(f.priceRange, FREE_ONLY)) out.push({ key: 'price', label: '무료만', clear: () => f.setPriceRange(PRICE_ALL) });
  else if (!isAll(f.priceRange, PRICE_ALL)) out.push({ key: 'price', label: `가격 ${rangeText(f.priceRange, priceLabel)}`, clear: () => f.setPriceRange(PRICE_ALL) });
  if (f.saleOnly) out.push({ key: 'sale', label: '할인 중', clear: () => f.setSaleOnly(false) });
  if (f.myPcActive) out.push({ key: 'mypc', label: '내 PC로 돌아가는 게임', clear: () => f.setMyPcOnly(false) });
  for (const [k, label] of NETS) if (f.selectedNet.includes(k)) out.push({ key: `n${k}`, label, clear: () => f.toggleNet(k) });
  for (const b of f.selectedBarriers) out.push({ key: `b${b}`, label: `진입장벽 ${b}`, clear: () => f.toggleBarrier(b) });
  if (withTags) for (const t of f.selectedTags) out.push({ key: `t${t}`, label: tagKeyLabel(t, f.tree) || '알 수 없는 태그', clear: () => f.toggleTag(t) });
  for (const t of f.excludedTags) out.push({ key: `x${t}`, label: `${tagKeyLabel(t, f.tree)} 빼고`, clear: () => f.toggleExcluded(t) });
  return out;
}
