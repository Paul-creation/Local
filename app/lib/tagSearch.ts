// 담당: 친구(검색·태그·비교)
// 검색창에 태그를 직접 입력하는 규칙 — "좀비, 협동" → 좀비 태그 + 협동 / "엘든링 협동" → 이름 엘든링 + 협동
// 입력을 쉼표·공백으로 나누고, 태그 이름(한국어)·영문 이름·별칭과 맞는 단어는 태그로, 나머지는 게임 이름 검색어로
// 비교는 searchMatch와 같은 규칙(소문자, 띄어쓰기·기호 무시). "온라인 협동"처럼 띄어 쓴 태그도 이어 붙여 맞춰 본다
// 태그 이름·별칭은 손으로 관리하지 않고 app/lib/tag-search-dict.json(scripts/build-tag-search.mjs가 태그 나무에서 생성)을 쓴다
//
// 고른 태그는 문자열 키로 다룬다:
// - 숫자 문자열("1663"): 태그 나무의 칸 번호 — 그 칸이나 아래 칸 태그를 하나라도 가진 게임 (app/lib/tagTree)
// - 협동·대전 단어: 태그 나무에서 뺀 인원·멀티 태그 대신 스팀 카테고리 플래그로 판정 (scripts/fill-steam-categories.mjs)
import { normalizeSearch } from './searchMatch';
import { gameNodes, type TagTree } from './tagTree';

type FlagField = 'has_online_coop' | 'has_local_coop' | 'has_pvp';
export const FLAG_TAGS: Record<string, FlagField[]> = {
  '협동': ['has_online_coop', 'has_local_coop'],
  '온라인 협동': ['has_online_coop'],
  '로컬 협동': ['has_local_coop'],
  '대전': ['has_pvp'],
};
// 협동·대전을 다르게 부르는 말
const FLAG_ALIASES: Record<string, string> = {
  '코옵': '협동', 'coop': '협동', 'co-op': '협동', 'online co-op': '온라인 협동', 'local co-op': '로컬 협동',
  'pvp': '대전', 'versus': '대전',
};

export const isTreeTag = (key: string) => /^\d+$/.test(key);

type TaggedGame = { tag_ids?: number[] | null } & Partial<Record<FlagField, boolean | null>>;

// 게임이 고른 태그(칸 번호 또는 협동·대전)에 맞는지
export function hasTag(game: TaggedGame, key: string, tree: TagTree | null) {
  if (FLAG_TAGS[key]) return FLAG_TAGS[key].some((f) => game[f]);
  if (!tree || !isTreeTag(key)) return false;
  return gameNodes(tree, game).has(Number(key));
}

// 칩·자동완성에 보여 줄 이름
export function tagKeyLabel(key: string, tree: TagTree | null) {
  if (!isTreeTag(key)) return key;
  return tree?.nodes.get(Number(key))?.ko ?? '';
}

// 한 태그가 몇 단어까지 띄어 써질 수 있는지 (예: "Open World Survival Craft")
const MAX_WORDS = 4;

export type TagLookup = Map<string, string>; // 정규화한 이름 → 태그 키

// counts: 칸마다 게임 수 — 게임이 하나도 없는 칸으로 가는 이름은 버린다 (결과 0개 방지)
export function buildTagLookup(tree: TagTree | null, counts: Map<number, number>): TagLookup {
  const lookup: TagLookup = new Map();
  const add = (name: string, key: string) => {
    const k = normalizeSearch(name);
    if (k && !lookup.has(k)) lookup.set(k, key);
  };
  for (const name of Object.keys(FLAG_TAGS)) add(name, name);
  for (const [name, key] of Object.entries(FLAG_ALIASES)) add(name, key);
  if (tree) {
    // 칸 이름 그대로가 별칭보다 먼저 (사전 keys는 이미 우선순위대로 정리돼 있음)
    for (const n of tree.nodes.values()) if (counts.get(n.id)) add(n.ko, String(n.id));
    for (const [k, id] of tree.keys) if (counts.get(id) && !lookup.has(k)) lookup.set(k, String(id));
  }
  return lookup;
}

export function splitWords(input: string) {
  return input.split(/[,\s]+/).filter(Boolean);
}

// 앞에서부터 가장 긴 묶음(여러 단어)부터 태그인지 보고, 태그가 아닌 단어는 원래 순서대로 이름 검색어로 남긴다
export function parseSearchInput(input: string, lookup: TagLookup) {
  const words = splitWords(input);
  const tags: string[] = [];
  const rest: string[] = [];
  for (let i = 0; i < words.length; ) {
    let span = 0;
    for (let n = Math.min(MAX_WORDS, words.length - i); n >= 1; n--) {
      const tag = lookup.get(normalizeSearch(words.slice(i, i + n).join('')));
      if (tag) {
        if (!tags.includes(tag)) tags.push(tag);
        span = n;
        break;
      }
    }
    if (span) i += span;
    else rest.push(words[i++]);
  }
  return { tags, rest: rest.join(' ') };
}

// 자동완성용 태그 후보 — 마지막 단어로 시작하는 태그 먼저, 그다음 포함하는 태그
export function suggestTags(word: string, lookup: TagLookup, exclude: string[], limit: number) {
  const q = normalizeSearch(word);
  if (!q) return [];
  // 태그마다 [시작=0·포함=1, 맞은 이름 길이] 중 가장 좋은 것 — 짧은 이름(더 딱 맞는 것)이 먼저
  const rank = new Map<string, [number, number]>();
  for (const [key, tag] of lookup) {
    if (exclude.includes(tag)) continue;
    const r = key.startsWith(q) ? 0 : key.includes(q) ? 1 : -1;
    if (r < 0) continue;
    const cur = rank.get(tag);
    if (!cur || cur[0] > r || (cur[0] === r && cur[1] > key.length)) rank.set(tag, [r, key.length]);
  }
  return [...rank].sort((a, b) => a[1][0] - b[1][0] || a[1][1] - b[1][1]).slice(0, limit).map(([tag]) => tag);
}
