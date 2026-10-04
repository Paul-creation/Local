// scripts/build-tag-search.mjs — data/tags/tree.json에서 태그 검색 사전(app/lib/tag-search-dict.json)을 만든다 (AI·DB 안 씀)
// 실행: node scripts/build-tag-search.mjs
// - 한국어 이름, 영문 이름, 스팀 원래 한국어 이름, 합친 태그(merged_from)의 이름, 별칭(aliases)을 모두 같은 태그로 연결
// - 비교 규칙은 app/lib/searchMatch.ts의 normalizeSearch와 같음 (소문자, 띄어쓰기·기호 제거)
// - 같은 글자가 여러 태그로 갈 때는 우선순위(한국어 이름 > 영문 > 스팀 원래 이름 > 합친 태그 > 별칭)가 높은 쪽, 같으면 먼저 나온 쪽. 겹친 목록은 출력
// - tagSearch.ts의 손으로 쓴 표(TAG_MAP_EN·EXTRA_ALIASES)를 대신하려고 만든 것. 화면 연결은 게임 태그를 새 나무 기준으로 옮긴 뒤에 한다
import fs from 'node:fs';

const normalize = (text) => String(text || '').toLowerCase().replace(/[\s\p{P}\p{S}]/gu, '');
const { nodes } = JSON.parse(fs.readFileSync('data/tags/tree.json', 'utf8'));

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
  // 정규화한 검색어 → 태그 노드 id
  keys: Object.fromEntries([...best].sort((a, b) => a[0].localeCompare(b[0])).map(([k, v]) => [k, v.node.id])),
  // 노드 id → 화면 이름·게임 수 (0개짜리는 hidden: true)
  tags: Object.fromEntries(nodes.map((n) => [n.id, { ko: n.ko, en: n.en, group: !n.steam_tag_id, count: n.subtree_count, ...(n.hidden_empty ? { hidden: true } : {}) }])),
};
fs.writeFileSync('app/lib/tag-search-dict.json', JSON.stringify(dict, null, 2) + '\n');
console.log(`검색어 ${best.size}개 → 태그 ${nodes.length}개 · app/lib/tag-search-dict.json`);
if (clashes.length) console.log(`겹치는 이름 ${clashes.length}개 (우선순위대로 정리됨)\n` + clashes.map((c) => `  - ${c}`).join('\n'));
