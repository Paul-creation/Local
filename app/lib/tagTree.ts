// 담당: 친구(검색·태그·비교)
// 태그 나무 (필터 아코디언·검색창 태그·카드/상세 태그 이름) — 서버·브라우저 어디서나 쓰는 순수 함수
// 데이터: app/lib/tag-search-dict.json (scripts/build-tag-search.mjs가 data/tags/tree.json에서 생성)
// 게임 목록(/api/games/list)에는 태그 번호(tag_ids)만 있고, 이름·부모는 여기서 찾는다
import { normalizeSearch } from './searchMatch';
import { translateTag } from './tagTranslate';

export type TagDict = {
  keys: Record<string, number>;
  tree: [number, string, number | null, string | 0][]; // [번호, 한국어 이름, 부모 번호, 묶음 칸 키 | 0]
};

export type TagNode = { id: number; ko: string; parent: number | null; group: string | null; children: number[]; depth: number };
export type TagTree = {
  nodes: Map<number, TagNode>;
  roots: number[];
  keys: Map<string, number>;
  contentId: number | null; // "이용 연령·표현" (빼고 보기)
};

// 이용 연령·표현 아래에서 "빼고 보기"로 쓰는 칸 — 선정성·폭력·고어·유혈 (가족 친화는 빼고 보기 대상이 아님)
export const EXCLUDE_TAG_IDS = [12095, 4667, 4345];

export function buildTree(dict: TagDict): TagTree {
  const nodes = new Map<number, TagNode>();
  const roots: number[] = [];
  for (const [id, ko, parent, group] of dict.tree) {
    nodes.set(id, { id, ko, parent, group: group || null, children: [], depth: 1 });
  }
  for (const n of nodes.values()) {
    if (n.parent == null) roots.push(n.id);
    else nodes.get(n.parent)?.children.push(n.id);
  }
  for (const n of nodes.values()) {
    let d = 1;
    for (let p = n.parent; p != null; p = nodes.get(p)?.parent ?? null) d++;
    n.depth = d;
  }
  const contentId = [...nodes.values()].find((n) => n.group === 'g:content')?.id ?? null;
  return { nodes, roots, keys: new Map(Object.entries(dict.keys)), contentId };
}

// 사전은 첫 화면 뒤에 따로 받는다 (메인 첫 로드 JS에 싣지 않음)
let dictPromise: Promise<TagTree> | null = null;
export function loadTagTree() {
  if (!dictPromise) dictPromise = import('./tag-search-dict.json').then((m) => buildTree(m.default as unknown as TagDict));
  return dictPromise;
}

// 게임이 가진 태그 + 그 위 칸 전부 (상위 칸을 고르면 아래 태그 중 하나라도 가진 게임이 나오게)
const nodeSets = new WeakMap<object, Set<number>>();
export function gameNodes(tree: TagTree, game: { tag_ids?: number[] | null }) {
  let set = nodeSets.get(game);
  if (set) return set;
  set = new Set<number>();
  for (const id of game.tag_ids || []) {
    for (let cur: number | null = id; cur != null && !set.has(cur); cur = tree.nodes.get(cur)?.parent ?? null) set.add(cur);
  }
  nodeSets.set(game, set);
  return set;
}

// 칸마다 해당하는 게임 수 (0개인 칸은 화면에서 숨김)
export function countByNode(tree: TagTree, games: { tag_ids?: number[] | null }[]) {
  const counts = new Map<number, number>();
  for (const g of games) for (const id of gameNodes(tree, g)) counts.set(id, (counts.get(id) || 0) + 1);
  return counts;
}

export const tagName = (tree: TagTree | null, id: number) => tree?.nodes.get(id)?.ko ?? '';

// 카드·상세에 보여 줄 태그 이름 — 새 태그 번호가 있으면 나무 이름, 없으면(마이그레이션 전) 예전 한국어 태그
export function displayTags(tree: TagTree | null, game: { tag_ids?: number[] | null; tags?: string[] | null }, limit: number) {
  if (game.tag_ids?.length && tree) return game.tag_ids.map((id) => tagName(tree, id)).filter(Boolean).slice(0, limit);
  return (game.tags || []).slice(0, limit).map(translateTag);
}

// 예전 주소의 태그 이름(?tags=좀비,오픈월드) → 태그 번호. 모르는 이름은 null
export function nameToTagId(tree: TagTree, name: string) {
  return tree.keys.get(normalizeSearch(name)) ?? null;
}

// 칸의 위 칸들 이름 (예: "장르 › 슈팅")
export function tagPath(tree: TagTree, id: number) {
  const names: string[] = [];
  for (let p = tree.nodes.get(id)?.parent ?? null; p != null; p = tree.nodes.get(p)?.parent ?? null) names.unshift(tagName(tree, p));
  return names.join(' › ');
}
