// 실행: npm test — 출시 예정·데모 표시 규칙
import test from 'node:test';
import assert from 'node:assert/strict';
import { isComingSoon, hasDemo, comingSoonLabel, hasReleaseDate, demoStoreUrl, daysUntilRelease, releaseTile } from './release.ts';

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

test('가격 자리 문구: 날짜(숫자)가 있으면 출시 예정 · 원문, 없으면 출시 예정 · 날짜 미정', () => {
  assert.equal(comingSoonLabel({ release_date_text: '2026년 4분기' }), '출시 예정 · 2026년 4분기');
  assert.equal(comingSoonLabel({ release_date_text: ' 2026년 11월 ' }), '출시 예정 · 2026년 11월');
  for (const text of ['출시 예정', '발표 예정', 'Coming soon', 'To be announced', 'TBA', '', null]) {
    assert.equal(comingSoonLabel({ release_date_text: text }), '출시 예정 · 날짜 미정', String(text));
  }
  assert.equal(comingSoonLabel({}), '출시 예정 · 날짜 미정');
});

test('실제 게임: Ebbtide(4915700)·아키에이지 크로니클은 날짜 미정', () => {
  assert.equal(comingSoonLabel({ release_date_text: '출시 예정' }), '출시 예정 · 날짜 미정'); // Ebbtide 4915700
  assert.equal(comingSoonLabel({ release_date_text: '발표 예정' }), '출시 예정 · 날짜 미정'); // 아키에이지 크로니클 3218230
  assert.equal(hasReleaseDate({ release_date_text: '발표 예정' }), false);
  assert.equal(hasReleaseDate({ release_date_text: '2027년 1분기' }), true);
});

test('데모 상점 페이지 주소', () => {
  assert.equal(demoStoreUrl('4000111'), 'https://store.steampowered.com/app/4000111');
});

test('D-N: 날짜까지 있는 원문만 세고 한국 날짜 기준', () => {
  const now = new Date('2026-11-08T15:30:00Z'); // 한국은 11/9 00:30
  assert.equal(daysUntilRelease({ release_date_text: '2026년 11월 26일' }, now), 17);
  assert.equal(daysUntilRelease({ release_date_text: '2026년 11월 9일' }, now), 0);
  assert.equal(daysUntilRelease({ release_date_text: '2026년 11월 8일' }, now), null);
  assert.equal(daysUntilRelease({ release_date_text: '2027년 1월' }, now), null);
  assert.equal(daysUntilRelease({ release_date_text: '2026년 4분기' }, now), null);
  assert.equal(daysUntilRelease({ release_date_text: '출시 예정' }, now), null);
  assert.equal(daysUntilRelease({}, now), null);
});

test('출시 예정 타일: D-N, 당일 D-DAY, 대략 날짜는 원문, 미정은 날짜 미정', () => {
  const now = new Date('2026-11-08T00:00:00Z');
  assert.deepEqual(releaseTile({ release_date_text: '2026년 12월 1일' }, now), { label: '출시까지', value: 'D-23', exact: true });
  assert.equal(releaseTile({ release_date_text: '2026년 11월 8일' }, now).value, 'D-DAY');
  assert.deepEqual(releaseTile({ release_date_text: '2027년 1분기' }, now), { label: '출시일', value: '2027년 1분기', exact: false });
  assert.equal(releaseTile({ release_date_text: '발표 예정' }, now).value, '날짜 미정');
});
