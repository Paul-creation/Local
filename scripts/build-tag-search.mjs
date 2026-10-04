// scripts/build-tag-search.mjs — data/tags/tree.json에서 태그 사전(app/lib/tag-search-dict.json)을 만든다 (AI·DB 안 씀)
// 실행: node scripts/build-tag-search.mjs   (tree.json을 고친 뒤 다시 실행)
// 이 사전 하나로 메인 필터 아코디언(태그 나무)·검색창 태그 입력·카드/상세의 태그 이름을 그린다 — 게임 목록에는 태그 번호만 보냄
// - keys: 정규화한 검색어 → 태그 번호(num). 한국어 이름·영문·스팀 원래 한국어 이름·합친 태그(merged_from)·별칭(aliases)
//   비교 규칙은 app/lib/searchMatch.ts의 normalizeSearch와 같음 (소문자, 띄어쓰기·기호 제거)
//   같은 글자가 여러 태그로 갈 때는 우선순위(한국어 이름 > 영문 > 스팀 원래 이름 > 합친 태그 > 별칭)가 높은 쪽, 같으면 먼저 나온 쪽
// - tree: 나무 순서대로 [번호, 한국어 이름, 부모 번호 | null, 묶음 칸 키('g:genre' 등) | 0]
// - 협동·대전처럼 플래그로 판정하는 단어는 여기 없고 app/lib/tagSearch.ts가 따로 처리한다 (나무에서 제외된 태그)
import fs from 'node:fs';

const normalize = (text) => String(text || '').toLowerCase().replace(/[\s\p{P}\p{S}]/gu, '');
const { nodes } = JSON.parse(fs.readFileSync('data/tags/tree.json', 'utf8'));
if (nodes.some((n) => typeof n.num !== 'number')) throw new Error('tree.json에 num이 없는 노드가 있어요');

const PRIORITY = { ko: 0, en: 1, steam_ko: 2, merged: 3, alias: 4 };
const best = new Map(); // key → { node, rank }
const clashes = [];
for (const n of nodes) {
  const names = [
    [n.ko, 'ko'], [n.en, 'en'], [n.steam_ko, 'steam_ko'],
    ...(n.merged_from || []).flatMap((m) => [[m.en, 'merged'], [m.ko, 'merged']]),
    ...(n.aliases || []).map((a) => [a, 'alias']),
  ];
  for (const [name, kind] of names) {
    const key = normalize(name);
    if (!key) continue;
    const cur = best.get(key);
    const rank = PRIORITY[kind];
    if (!cur) best.set(key, { node: n, rank });
    else if (cur.node.id !== n.id) {
      clashes.push(`"${name}" → ${cur.node.ko}(유지) / ${n.ko}`);
      if (rank < cur.rank) best.set(key, { node: n, rank });
    }
  }
}

const dict = {
  generated_by: 'scripts/build-tag-search.mjs (data/tags/tree.json에서 자동 생성 — 직접 고치지 말 것)',
  keys: Object.fromEntries([...best].sort((a, b) => a[0].localeCompare(b[0])).map(([k, v]) => [k, v.node.num])),
  tree: nodes.map((n) => [n.num, n.ko, n.parent_num ?? null, n.steam_tag_id ? 0 : n.id]),
};
fs.writeFileSync('app/lib/tag-search-dict.json', JSON.stringify(dict) + '\n');
console.log(`검색어 ${best.size}개 → 태그 ${nodes.length}개 · app/lib/tag-search-dict.json (${(fs.statSync('app/lib/tag-search-dict.json').size / 1024).toFixed(1)}KB)`);
if (clashes.length) console.log(`겹치는 이름 ${clashes.length}개 (우선순위대로 정리됨)\n` + clashes.map((c) => `  - ${c}`).join('\n'));
