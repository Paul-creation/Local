// 실행: npm test — 관리자 캡션 붙여넣기 게시물 연결 도구의 매칭·파싱·주소 정리
import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeName, matchGames, parseExtraction, cleanNames, normalizePostUrl, postTypeFor, postedAtIso, firstLine } from './curatorImport.ts';

const g = (id, name, display_name = null, search_name_ko = null) => ({ id, name, display_name, search_name_ko });
const GAMES = [
  g('1', 'LEGO® Voyagers'),
  g('2', '우리는 여기에 있었다', null, '우리는 여기에 있었다, We Were Here'),
  g('3', 'It Takes Two'),
  g('4', 'Split Fiction'),
  g('5', 'Unravel Two'),
  g('6', 'PANICORE (패니코어)', 'PANICORE', 'PANICORE (패니코어), 패니코어'),
  g('7', 'Two Point Hospital'),
];

test('정규화: 대소문자·기호·™®·공백 차이를 없앤다', () => {
  assert.equal(normalizeName('LEGO® Voyagers™'), 'legovoyagers');
  assert.equal(normalizeName(' It  Takes-Two '), 'ittakestwo');
  assert.equal(normalizeName('우리는, 여기에 있었다'), '우리는여기에있었다');
  assert.equal(normalizeName('🎮 !!'), '');
});

test('정확 일치가 정규화·부분 일치보다 앞선다', () => {
  const r = matchGames('Unravel Two', GAMES);
  assert.deepEqual(r.map((m) => [m.game.id, m.tier]), [['5', 'exact']]);
  assert.equal(matchGames('it takes two', GAMES)[0].tier, 'exact');
});

test('정규화 일치: ® 같은 기호 차이', () => {
  const r = matchGames('LEGO Voyagers', GAMES);
  assert.deepEqual(r.map((m) => [m.game.id, m.tier]), [['1', 'normalized']]);
});

test('search_name_ko의 쉼표 별칭으로 영문·한글 이름 모두 찾는다', () => {
  assert.equal(matchGames('We Were Here', GAMES)[0].game.id, '2');
  assert.equal(matchGames('패니코어', GAMES)[0].game.id, '6');
  assert.equal(matchGames('패니코어', GAMES)[0].tier, 'exact');
});

test('부분 일치: 단계 순, 이름 길이가 비슷한 순, 최대 3개', () => {
  const r = matchGames('Two', GAMES);
  assert.deepEqual(r.map((m) => m.game.id), ['3', '5', '7']);
  assert.ok(r.length <= 3 && r.every((m) => m.tier === 'partial'));
  const many = Array.from({ length: 6 }, (_, i) => g(`x${i}`, `Super Game ${'a'.repeat(i)}`));
  assert.equal(matchGames('Super Game', many).length, 3);
});

test('너무 짧은 이름은 부분 일치를 하지 않는다', () => {
  assert.deepEqual(matchGames('Tw', GAMES), []);
  assert.deepEqual(matchGames('', GAMES), []);
  assert.deepEqual(matchGames('이', [g('k', '이상한 게임')]), []);
  assert.equal(matchGames('이상', [g('k', '이상한 게임')])[0].tier, 'partial');
});

test('찾는 게임이 없으면 빈 배열', () => {
  assert.deepEqual(matchGames('Totally Unknown Title', GAMES), []);
});

test('AI 응답 파싱: 코드 펜스·설명이 붙어도 읽고, 깨지면 빈 결과', () => {
  const t = '```json\n{"title":"협동 게임 모음","games":["1. It Takes Two"," Split Fiction ","it takes two",3,""]}\n```';
  assert.deepEqual(parseExtraction(t), { title: '협동 게임 모음', games: ['It Takes Two', 'Split Fiction'] });
  assert.deepEqual(parseExtraction('죄송합니다'), { title: '', games: [] });
  assert.deepEqual(parseExtraction('{깨진'), { title: '', games: [] });
  assert.deepEqual(parseExtraction('{"games":"문자열"}'), { title: '', games: [] });
});

test('이름 정리: 번호 머리말 제거·중복 제거·길이와 개수 제한', () => {
  assert.deepEqual(cleanNames(['1) A Way Out', '- Biped', 'a way out']), ['A Way Out', 'Biped']);
  assert.equal(cleanNames(['x'.repeat(200)])[0].length, 80);
  assert.equal(cleanNames(Array.from({ length: 100 }, (_, i) => `Game ${i}`)).length, 40);
});

test('캡션 첫 줄: 빈 줄은 건너뛰고 120자까지', () => {
  assert.equal(firstLine('\n\n  10월 기대작 모음  \n둘째 줄'), '10월 기대작 모음');
  assert.equal(firstLine('가'.repeat(300)).length, 120);
  assert.equal(firstLine(''), '');
});

test('인스타 주소: 저장 형식으로 정리하고 다른 주소는 거절', () => {
  assert.equal(normalizePostUrl('https://www.instagram.com/p/DelqRHjIMJZ/?igsh=abc'), 'https://www.instagram.com/p/DelqRHjIMJZ/');
  assert.equal(normalizePostUrl('https://instagram.com/reel/DelqRHjIMJZ'), 'https://www.instagram.com/reel/DelqRHjIMJZ/');
  assert.equal(normalizePostUrl('https://www.instagram.com/nugget_zine/p/DetxdbFmjWS/'), 'https://www.instagram.com/p/DetxdbFmjWS/');
  assert.equal(normalizePostUrl('http://www.instagram.com/p/DelqRHjIMJZ/'), null);
  assert.equal(normalizePostUrl('https://evil.com/p/DelqRHjIMJZ/'), null);
  assert.equal(normalizePostUrl('https://www.instagram.com.evil.com/p/DelqRHjIMJZ/'), null);
  assert.equal(normalizePostUrl('https://www.instagram.com/nugget_zine/'), null);
  assert.equal(normalizePostUrl('javascript:alert(1)'), null);
  assert.equal(normalizePostUrl(''), null);
});

test('게시물 종류와 날짜', () => {
  assert.equal(postTypeFor(1), 'single');
  assert.equal(postTypeFor(2), 'collection');
  assert.equal(postedAtIso('2026-10-24'), '2026-10-24T03:00:00.000Z');
  assert.equal(postedAtIso('2026-02-30'), null);
  assert.equal(postedAtIso('24-10-2026'), null);
  assert.equal(postedAtIso(''), null);
});
