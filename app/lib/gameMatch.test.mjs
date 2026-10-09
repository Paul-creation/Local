// 실행: npm test — 게임 이름 찾기 (정규화: the·서수, "롤" 예외와 제외어, 별칭, 오매칭 방지)
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMatchers, matchGames, nameVariants } from './gameMatch.mjs';

const G = {
  lol: { id: 'lol', name: 'League of Legends', search_name_ko: '롤, 리그 오브 레전드' },
  ow: { id: 'ow', name: 'Overwatch 2', search_name_ko: '오버워치 2, 오버워치' },
  dbd: { id: 'dbd', name: 'Dead by Daylight', search_name_ko: '데드 바이 데이라이트, DBD, 데바데' },
  zomboid: { id: 'zomboid', name: 'Project Zomboid', search_name_ko: '프로젝트 좀보이드, 좀보이드' },
  sky: { id: 'sky', name: '하늘의 궤적 the 2nd', search_name_ko: null },
  forest: { id: 'forest', name: 'The Forest', search_name_ko: null },
  sims: { id: 'sims', name: 'The Sims 4', search_name_ko: null },
  beast: { id: 'beast', name: 'Dying Light: The Beast', search_name_ko: null },
  foo: { id: 'foo', name: 'Foo Quest 3rd', search_name_ko: null },
};
const matchers = buildMatchers(Object.values(G));
const ids = (text) => matchGames(text, matchers);

test('nameVariants: 앞의 the는 떼고, 서수 앞 the는 있어도 없어도 같게', () => {
  assert.deepEqual(nameVariants('하늘의 궤적 the 2nd').map((v) => v.spaced), ['하늘의 궤적 the 2nd', '하늘의 궤적 2nd']);
  assert.deepEqual(nameVariants('하늘의 궤적 2nd').map((v) => v.spaced), ['하늘의 궤적 2nd', '하늘의 궤적 the 2nd']);
  assert.deepEqual(nameVariants('the sims 4').map((v) => v.spaced), ['the sims 4', 'sims 4']);
  assert.deepEqual(nameVariants('the forest').map((v) => v.spaced), ['the forest']); // 한 낱말이 남으면 안 뗌
});

test('"the 2nd"와 "2nd"를 같게 본다 (별칭 없이도)', () => {
  assert.deepEqual(ids('하늘의 궤적 2nd 나메난이도 #3 3장'), ['sky']);
  assert.deepEqual(ids('하늘의 궤적 the 2nd 방송'), ['sky']);
  assert.deepEqual(ids('foo quest the 3rd 리뷰'), ['foo']);
  assert.deepEqual(ids('Foo Quest 3rd'), ['foo']);
});

test('앞의 the는 무시: "sims 4"로도 The Sims 4', () => {
  assert.deepEqual(ids('오늘은 sims 4 건축'), ['sims']);
  assert.deepEqual(ids('The Sims 4 건축'), ['sims']);
});

test('앞의 the를 뗀 이름은 단어 경계로만 비교 (rainforest·forests 오매칭 방지, 한 낱말은 안 뗌)', () => {
  assert.deepEqual(ids('rainforest 탐험'), []);
  assert.deepEqual(ids('the forest 생존기'), ['forest']);
});

test('Dying Light: The Beast 안의 이름 겹침 정리는 그대로', () => {
  assert.deepEqual(ids('Dying Light The Beast 후기'), ['beast']);
});

test('"롤"은 독립된 단어일 때만 League of Legends', () => {
  const yes = ['롤 렁키즈 내전', '오늘 롤 한판', '[롤] 방송', '(롤) 내전', '롤, 배그', '롤을 했다', '오늘 롤이랑 배그', '롤은 재밌다', '롤 1대1', '롤.'];
  for (const t of yes) assert.deepEqual(ids(t), ['lol'], t);
});

test('"롤" 뒤에 글자가 붙은 낱말은 안 됨: 롤케이크·롤러코스터·롤링·롤드컵·롤백', () => {
  const no = ['롤케이크 만들기', '롤러코스터 탑승', '롤링 스톤즈', '롤드컵 결승', '롤백 했다', '초밥롤', '핫도그롤 레시피', 'role롤플레이'];
  for (const t of no) assert.deepEqual(ids(t), [], t);
});

test('"롤" 뒤에 카드·TCG·리프트바운드·토체스가 오면 제외', () => {
  const no = ['롤 리프트바운드 카드깡', '카드 1장 = 800만원, 롤 리프트바운드 카드깡 [테스터훈의 은밀한 사생활]', '롤 카드 뽑기', '롤 TCG 후기', '롤 tcg', '롤 토체스', '롤토체스'];
  for (const t of no) assert.deepEqual(ids(t), [], t);
  assert.deepEqual(ids('롤 하다가 리프트바운드 카드깡'), ['lol']); // 바로 뒤가 아니면 그대로
});

test('1글자 별칭은 "롤"만 예외: 다른 1글자는 여전히 안 씀', () => {
  const m = buildMatchers([{ id: 'x', name: 'Some Game', search_name_ko: '썸겜, 가, 겜' }]);
  assert.deepEqual(matchGames('가 가 가 겜 겜', m), []); // 1글자 "가"·"겜"은 안 쓰고
  assert.deepEqual(matchGames('썸겜 좋아', m), ['x']); // 2글자는 쓰임
});

test('별칭: 오버워치·데바데·좀보이드', () => {
  assert.deepEqual(ids('오버워치 픽셀컵2'), ['ow']);
  assert.deepEqual(ids('데바데 내전'), ['dbd']);
  assert.deepEqual(ids('칸삼쥐노포 좀보이드 6편'), ['zomboid']);
  assert.deepEqual(ids('오버워치 2 하이라이트'), ['ow']);
});

test('별칭이 없던 때(예전 별칭만)는 오버워치·데바데·좀보이드를 놓침 — SQL로 별칭을 더하는 이유', () => {
  const old = buildMatchers([
    { ...G.ow, search_name_ko: '오버워치 2' }, { ...G.dbd, search_name_ko: '데드 바이 데이라이트, DBD' }, { ...G.zomboid, search_name_ko: '프로젝트 좀보이드' },
  ]);
  assert.deepEqual(matchGames('오버워치 픽셀컵2 + 데바데 내전 + 좀보이드', old), []);
});

test('한 영상에서 겹치는 이름은 긴 쪽 우선, 먼저 나온 순서로 최대 3개', () => {
  assert.deepEqual(ids('롤 하다가 데바데 하고 오버워치까지'), ['lol', 'dbd', 'ow']);
});

test('여러 게임의 search_name_ko에 같이 있는 별칭은 건너뛰고, 한 게임만 쓰는 별칭은 그대로 쓴다', () => {
  const m = buildMatchers([
    { id: 'wilds', name: 'Monster Hunter Wilds', search_name_ko: '몬스터 헌터 와일즈, 몬헌 와일즈, 몬헌' },
    { id: 'world', name: 'Monster Hunter: World', search_name_ko: '몬스터 헌터 월드, 몬헌' },
    { id: 'pubg', name: 'PUBG: BATTLEGROUNDS', search_name_ko: '펍지, 배그' },
  ]);
  assert.deepEqual(matchGames('몬헌 재밌다', m), []);
  assert.deepEqual(matchGames('몬헌 와일즈 후기', m), ['wilds']);
  assert.deepEqual(matchGames('오늘 배그 한판', m), ['pubg']);
  assert.deepEqual(matchGames('몬스터 헌터 월드 방송', m), ['world']);
});
