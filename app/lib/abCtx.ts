// 에어비앤비식 검색(abSearch.ts)에 태그 나무를 연결한다 — 태그 이름(정규화) → 칸 번호 → 게임이 그 칸 또는 아래 칸 태그를 가졌는지
import { gameNodes, type TagTree } from './tagTree';
import { matchesGame, normalizeSearch } from './searchMatch';
import { NO_TAGS, type AbCtx, type KwMatcher } from './abSearch';

export function makeAbCtx(tree: TagTree | null): AbCtx {
  if (!tree) return NO_TAGS;
  const ids = new Map<string, number[]>();
  const idsOf = (names: string[]) => {
    const key = names.join('|');
    let hit = ids.get(key);
    if (!hit) {
      hit = names.map((n) => tree.keys.get(normalizeSearch(n))).filter((x): x is number => x != null);
      ids.set(key, hit);
    }
    return hit;
  };
  return { hasTag: (g, names) => { const want = idsOf(names); return want.length > 0 && want.some((id) => gameNodes(tree, g).has(id)); } };
}

// 직접 입력: 게임 이름(영문·한글·별명)이거나, 입력이 태그 이름과 같으면 그 태그를 가진 게임
export function makeKwMatcher(tree: TagTree | null): KwMatcher {
  return (g, kw) => {
    if (matchesGame(g, kw)) return true;
    const id = tree?.keys.get(normalizeSearch(kw));
    return id != null && !!tree && gameNodes(tree, g).has(id);
  };
}
