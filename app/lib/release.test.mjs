// 실행: npm test — 출시 예정·데모 표시 규칙
import test from 'node:test';
import assert from 'node:assert/strict';
import { isComingSoon, hasDemo, comingSoonLabel, demoStoreUrl } from './release.ts';

test('출시 예정 판정: release_status가 coming_soon일 때만 (칸이 없으면 출시된 게임)', () => {
  assert.equal(isComingSoon({ release_status: 'coming_soon' }), true);
  assert.equal(isComingSoon({ release_status: 'released' }), false);
  assert.equal(isComingSoon({}), false);
});

test('데모 칩·버튼은 출시 예정 게임이 데모를 가진 경우만', () => {
  assert.equal(hasDemo({ release_status: 'coming_soon', demo_appid: '4000111' }), true);
  assert.equal(hasDemo({ release_status: 'coming_soon', demo_appid: null }), false);
  assert.equal(hasDemo({ release_status: 'released', demo_appid: '4000111' }), false);
  assert.equal(hasDemo({ demo_appid: '4000111' }), false);
});

test('가격 자리 문구: 출시 예정 · 출시일 원문, 날짜가 없거나 "출시 예정"뿐이면 한 번만', () => {
  assert.equal(comingSoonLabel({ release_date_text: '2026년 11월' }), '출시 예정 · 2026년 11월');
  assert.equal(comingSoonLabel({ release_date_text: ' 2026년 11월 ' }), '출시 예정 · 2026년 11월');
  assert.equal(comingSoonLabel({ release_date_text: '출시 예정' }), '출시 예정');
  assert.equal(comingSoonLabel({ release_date_text: 'Coming soon' }), '출시 예정');
  assert.equal(comingSoonLabel({ release_date_text: null }), '출시 예정');
  assert.equal(comingSoonLabel({}), '출시 예정');
});

test('데모 상점 페이지 주소', () => {
  assert.equal(demoStoreUrl('4000111'), 'https://store.steampowered.com/app/4000111');
});
