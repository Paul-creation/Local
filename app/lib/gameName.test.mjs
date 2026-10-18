// 실행: npm test — 화면 표시명(display_name ?? name)과 검색의 display_name 매칭
import test from 'node:test';
import assert from 'node:assert/strict';
import { gameName } from './gameName.ts';
import { matchesGame } from './searchMatch.ts';

test('표시명: display_name이 있으면 그것, 없으면 name', () => {
  assert.equal(gameName({ name: 'Manor Lords 매너 로드', display_name: 'Manor Lords' }), 'Manor Lords');
  assert.equal(gameName({ name: 'Hades', display_name: null }), 'Hades');
  assert.equal(gameName({ name: 'Hades' }), 'Hades');
});

test('검색: name·search_name_ko에 더해 display_name으로도 찾는다', () => {
  const g = { name: '불과 얼음의 춤 (A Dance of Fire and Ice)', display_name: '불과 얼음의 춤', search_name_ko: null };
  assert.ok(matchesGame(g, '불과얼음'));
  assert.ok(matchesGame({ name: 'X', display_name: 'Manor Lords', search_name_ko: null }, 'manorlords'));
  assert.ok(!matchesGame({ name: 'X', display_name: 'Manor Lords' }, 'hades'));
});
