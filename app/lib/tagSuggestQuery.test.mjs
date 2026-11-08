import test from 'node:test';
import assert from 'node:assert/strict';
import { suggestQuery, planGameSearch, pickGames } from './tagSuggestQuery.ts';

test('단어 하나면 그 단어', () => {
  assert.equal(suggestQuery(['협'], false), '협');
  assert.equal(suggestQuery([], false), '');
});

test('앞 단어가 태그가 아니면 입력 전체 — finals w가 w만으로 걸리지 않는다', () => {
  assert.equal(suggestQuery(['finals', 'w'], false), 'finals w');
});

test('태그를 이어 치는 중이면 마지막 단어, 영문·숫자 한 글자만 제외', () => {
  assert.equal(suggestQuery(['좀비', '협동'], true), '협동');
  assert.equal(suggestQuery(['좀비', '협'], true), '협'); // 한글 한 글자는 허용
  assert.equal(suggestQuery(['좀비', 'w'], true), ''); // 영문 한 글자는 막음
  assert.equal(suggestQuery(['좀비', '4'], true), ''); // 숫자 한 글자도 막음
});

// ── 게임 결과 매칭 ──
const norm = (x) => String(x).toLowerCase().replace(/[\s\p{P}\p{S}]/gu, '');
const rank = (g, q) => { const k = norm(q); let r = -1; for (const n of [g.name, ...(g.alias ?? [])]) { const m = norm(n); if (m.startsWith(k)) return 0; if (m.includes(k)) r = 1; } return r; };
const G = [
  { name: 'Finals Week', tags: ['협동'], heat: 3 },
  { name: 'It Takes Two', tags: ['협동'], heat: 2 },
  { name: 'Witchbrook', tags: [], heat: 9 },
  { name: 'Worst Class Ever', tags: [], heat: 8 },
  { name: 'Left 4 Dead 2', tags: ['좀비', '협동'], heat: 1 },
  { name: 'Zombie Army 4', tags: ['좀비'], heat: 5 },
  { name: 'World War Z', tags: ['좀비', '협동'], alias: ['월드워Z'], heat: 4 },
  { name: 'One Tank Trip', tags: ['협동'], alias: ['탱크 협동 게임'], heat: 7 },
  { name: '활협전', tags: [], heat: 6 },
];
const names = (words, prefixTags) => pickGames(G, planGameSearch(words, prefixTags), { rank, owns: (g, t) => g.tags.includes(t), heat: (g) => g.heat, limit: 6 }).map((g) => g.name);

test('"좀비 w": 영문 한 글자라 이름 매칭 없이 좀비 태그 게임만(인기순) — Witchbrook·Worst Class Ever는 안 나옴', () => {
  assert.deepEqual(names(['좀비', 'w'], ['좀비']), ['Left 4 Dead 2', 'World War Z', 'Zombie Army 4']);
});

test('"좀비 wo": 좀비 태그 게임 안에서 이름 매칭', () => {
  assert.deepEqual(names(['좀비', 'wo'], ['좀비']), ['World War Z']);
});

test('"좀비 협": 좀비 태그 게임 안에서만 찾는다 — One Tank Trip(별칭 탱크 협동 게임)·활협전은 안 나오고, 협동 태그 후보는 한글 한 글자라 나온다', () => {
  assert.deepEqual(names(['좀비', '협'], ['좀비']), []);
  assert.equal(suggestQuery(['좀비', '협'], true), '협');
});

test('"finals w": 입력 전체로 Finals Week만', () => {
  assert.deepEqual(names(['finals', 'w'], null), ['Finals Week']);
});

test('"it takes": It Takes Two', () => {
  assert.deepEqual(names(['it', 'takes'], null), ['It Takes Two']);
});

test('단어 하나는 지금처럼(w를 포함한 이름, 시작하는 이름 먼저)', () => {
  assert.deepEqual(names(['w'], null), ['Witchbrook', 'Worst Class Ever', 'World War Z', 'Finals Week', 'It Takes Two']);
});
