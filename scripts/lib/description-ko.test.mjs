import test from 'node:test';
import assert from 'node:assert/strict';
import { aboutToText, lacksSteamKorean, needsDescriptionKo, checkDescriptionKo } from './description-ko.mjs';

test('about HTML → 평문 (이미지 제거, 줄 유지)', () => {
  const t = aboutToText('<img src="x.gif"><h2 class="bb_tag">Co-op</h2><p>Climb &amp; jump with <b>friends</b>.</p><ul><li>Rope</li></ul>');
  assert.equal(t, 'Co-op\nClimb & jump with friends .\nRope');
});
test('스팀 한국어 설명 판정: 한글이 있으면 있음', () => {
  assert.equal(lacksSteamKorean({ description: 'A co-op game' }), true);
  assert.equal(lacksSteamKorean({ description: '친구와 하는 게임' }), false);
  assert.equal(lacksSteamKorean({ description: '' }), false);
});
test('대상: 영어 설명 + description_ko·처리 표시 없음', () => {
  assert.equal(needsDescriptionKo({ description: 'A game' }), true);
  assert.equal(needsDescriptionKo({ description: 'A game', description_ko: '이미 있어요.' }), false);
  assert.equal(needsDescriptionKo({ description: 'A game', description_ko_at: '2026-11-08' }), false);
  assert.equal(needsDescriptionKo({ description: '한국어 설명' }), false);
});
test('검사: 존댓말 2~3문장은 통과', () => {
  assert.deepEqual(checkDescriptionKo('밧줄 하나로 묶인 염소들이 함께 산 정상을 향해 오르는 협동 등반 게임이에요. 한 명이 실수하면 모두가 미끄러져 내려가기 때문에 서로 발을 맞추는 게 중요해요. 친구와 같이 하면 줄에 얽히는 순간마다 웃음이 터져요.'), []);
});
test('검사: ~입니다·~합니다·~세요는 탈락, ~거든요·~예요는 통과', () => {
  assert.ok(checkDescriptionKo('밧줄로 묶인 염소들이 산을 오르는 협동 등반 게임입니다. 한 명이 실수하면 모두 내려가야 해서 호흡이 중요합니다. 친구와 하면 줄에 얽힐 때마다 웃음이 터집니다.').length > 0);
  assert.ok(checkDescriptionKo('밧줄로 묶인 염소들이 산을 오르는 협동 등반 게임이에요. 한 명이 실수하면 모두 내려가야 해서 호흡이 중요해요. 친구와 같이 해 보세요.').length > 0);
  assert.deepEqual(checkDescriptionKo('밧줄로 묶인 염소들이 산을 오르는 협동 등반 게임이에요. 한 명이 실수하면 모두 내려가야 해서 호흡이 중요하거든요. 친구와 하면 줄에 얽힐 때마다 웃음이 터지는 게 매력이예요.'), []);
});
test('검사: 길이 상한 250자', () => {
  const long = '밧줄로 묶인 염소들이 산을 오르는 협동 등반 게임이에요. ' + '한 명이 실수하면 모두 내려가야 해서 호흡이 아주 중요하거든요 정말로요, '.repeat(6) + '친구와 하면 웃음이 터져요.';
  assert.ok(long.length > 250 && checkDescriptionKo(long).some((p) => p.includes('250')));
});
test('검사: 반말·한 문장·영어·마크다운은 걸린다', () => {
  assert.ok(checkDescriptionKo('친구와 산을 오르는 게임이다. 밧줄에 묶여 있다. 실수하면 떨어진다.').length > 0);
  assert.ok(checkDescriptionKo('짧아요.').length > 0);
  assert.ok(checkDescriptionKo('**협동** 게임이에요. 친구와 함께 산을 올라요. 밧줄이 얽히면 웃음이 터져요 정말로요 그렇게 되어요.').length > 0);
  assert.ok(checkDescriptionKo('This is a cooperative climbing game with friends 한글이에요. 밧줄에 묶인 채 함께 산을 올라야 해서 호흡이 중요해요. 한 명이 떨어지면 모두 내려가요.').length > 0);
});
