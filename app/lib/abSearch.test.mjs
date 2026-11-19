// 실행: npm test (Node 내장 테스트, .ts를 바로 불러온다)
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseQuery, queryToParams, search, badgesFor, groupTotal, fitsPlayers, countFitting, countMatching, NO_TAGS, EMPTY_QUERY, ALL_PARTS, summaryParts } from './abSearch.ts';

const kw = (g, k) => g.name.toLowerCase().includes(k.toLowerCase());
const G = [
  { id: 'a', name: 'Alpha', min_players: 1, max_players: 4, has_online_coop: true, themes: ['Horror'], is_free: true, entry_barrier: '낮음', heat_rank: 2 },
  { id: 'b', name: 'Beta', min_players: 2, max_players: 2, has_local_coop: true, price_final: 15000, lowest_price: 9000, entry_barrier: '높음', no_korean: true, heat_rank: 1 },
  { id: 'c', name: 'Gamma', has_pvp: true, price_final: 8000, price_discount: 20, korean_support: '자막' },
];

test('주소 ↔ 조건', () => {
  const q = parseQuery(new URLSearchParams('n=4&how=coop&g=horror,zzz&o=free,ko,bad&kw=abc'));
  assert.deepEqual(q, { n: 4, how: 'coop', genres: ['horror'], gm: 'all', kw: 'abc', opts: ['free', 'ko'] });
  assert.equal(queryToParams(q), 'n=4&how=coop&g=horror&kw=abc&o=free%2Cko');
  assert.deepEqual(parseQuery(new URLSearchParams('n=0&how=x')), EMPTY_QUERY);
});

test('인원: 비어 있으면 통과, 범위 밖이면 제외', () => {
  assert.equal(fitsPlayers(G[2], 8), true);
  assert.equal(fitsPlayers(G[1], 4), false);
  assert.equal(fitsPlayers(G[0], 1), true);
  assert.equal(countFitting(G, 4), 2);
});

test('조건이 없으면 전부, 인기순', () => {
  const r = search(G, EMPTY_QUERY, NO_TAGS, kw);
  assert.deepEqual(r.list.map((g) => g.id), ['b', 'a', 'c']);
  assert.equal(r.relaxed.length, 0);
});

test('무료 조건: 가격 값이 있는 유료 게임은 제외, 비어 있으면 통과', () => {
  const r = search(G, { ...EMPTY_QUERY, opts: ['free'] }, NO_TAGS, kw);
  assert.deepEqual(r.list.map((g) => g.id), ['a']);
});

test('결과 0개면 덜 중요한 조건부터 풀고 알려 준다', () => {
  const q = { ...EMPTY_QUERY, n: 2, how: 'pvp', opts: ['easy', 'free'] };
  const r = search(G, q, NO_TAGS, kw);
  assert.ok(r.list.length > 0);
  assert.deepEqual(r.relaxed.slice(0, 2), ['쉬운 게임', '무료']);
});

test('근거 배지와 합계', () => {
  const q = { ...EMPTY_QUERY, n: 4, how: 'coop', opts: ['ko'] };
  const b = badgesFor(G[0], q, ALL_PARTS(q), NO_TAGS).map((x) => x.text);
  assert.ok(b.includes('4인 온라인 협동') && b.includes('무료') && b.includes('처음 해도 쉬움'));
  const w = badgesFor(G[1], q, ALL_PARTS(q), NO_TAGS);
  assert.ok(w.some((x) => !x.ok && x.text === '한국어 지원 없음'));
  assert.ok(w.some((x) => !x.ok && x.text === '진입장벽 높음'));
  assert.equal(groupTotal(G[0], 4), '무료');
  assert.equal(groupTotal(G[1], 4), '4명 다 사면 ₩36,000 (역대 최저가 기준)');
  assert.equal(groupTotal(G[1], 1), null);
});

test('접힌 검색창 글자', () => {
  assert.deepEqual(summaryParts({ ...EMPTY_QUERY, n: 4, how: 'coop', genres: ['horror'] }), { who: '4명', how: '같이 깨기', what: '공포' });
});

test('장르 모두/하나라도: 주소에 gm이 없으면 all', () => {
  assert.equal(parseQuery(new URLSearchParams('g=horror,puzzle')).gm, 'all');
  assert.equal(parseQuery(new URLSearchParams('g=horror,puzzle&gm=all')).gm, 'all');
  assert.equal(parseQuery(new URLSearchParams('g=horror,puzzle&gm=any')).gm, 'any');
  assert.equal(parseQuery(new URLSearchParams('g=horror,puzzle&gm=zzz')).gm, 'all');
  assert.equal(queryToParams(parseQuery(new URLSearchParams('g=horror,puzzle&gm=any'))), 'g=horror%2Cpuzzle&gm=any');
  assert.equal(queryToParams(parseQuery(new URLSearchParams('g=horror,puzzle'))), 'g=horror%2Cpuzzle');
});

test('장르 모두/하나라도: 모두는 전부 가진 게임만, 하나라도는 합집합', () => {
  const games = [
    { id: 'h', name: 'H', themes: ['Horror'] },
    { id: 'p', name: 'P', genres: ['Puzzle'] },
    { id: 'hp', name: 'HP', themes: ['Horror'], genres: ['Puzzle'] },
  ];
  const base = { ...EMPTY_QUERY, genres: ['horror', 'puzzle'] };
  assert.deepEqual(search(games, base, NO_TAGS, kw).list.map((g) => g.id), ['h', 'p', 'hp'].filter((id) => id === 'hp'));
  assert.deepEqual(search(games, { ...base, gm: 'any' }, NO_TAGS, kw).list.map((g) => g.id).sort(), ['h', 'hp', 'p']);
  assert.equal(countMatching(games, base, NO_TAGS, kw), 1);
  assert.equal(countMatching(games, { ...base, gm: 'any' }, NO_TAGS, kw), 3);
});

test('칸 글자: 여럿이면 "공포 외 1개"', () => {
  assert.equal(summaryParts({ ...EMPTY_QUERY, genres: ['horror', 'cook'] }).what, '공포 외 1개');
  assert.equal(summaryParts({ ...EMPTY_QUERY, genres: ['horror'], kw: '좀비' }).what, '공포 외 1개');
  assert.equal(summaryParts({ ...EMPTY_QUERY, kw: '좀비' }).what, '좀비');
});

test('장르 모두로 0개면 하나라도로 대체, 그래도 0개면 장르를 푼다', () => {
  const games = [
    { id: 'h', name: 'H', themes: ['Horror'], heat_rank: 1 },
    { id: 'p', name: 'P', genres: ['Puzzle'], heat_rank: 2 },
    { id: 'x', name: 'X', heat_rank: 3 },
  ];
  const q = { ...EMPTY_QUERY, genres: ['horror', 'puzzle'] };
  const r = search(games, q, NO_TAGS, kw);
  assert.equal(r.genresAny, true);
  assert.deepEqual(r.list.map((g) => g.id), ['h', 'p']);
  assert.deepEqual(r.relaxed, []);
  const none = search(games, { ...q, genres: ['cook', 'racing'] }, NO_TAGS, kw);
  assert.equal(none.genresAny, false);
  assert.deepEqual(none.relaxed, ['장르']);
  assert.equal(none.list.length, 3);
  assert.equal(search(games, { ...q, gm: 'any' }, NO_TAGS, kw).genresAny, false);
  assert.equal(search(games, { ...EMPTY_QUERY, genres: ['horror'] }, NO_TAGS, kw).genresAny, false);
});
