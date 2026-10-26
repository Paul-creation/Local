// 실행: npm test — 큐레이터 공개 동의 규칙
import test from 'node:test';
import assert from 'node:assert/strict';
import { isGranted, showsOnHome } from './curatorConsent.ts';

test('granted만 공개', () => {
  assert.equal(isGranted('granted'), true);
  for (const s of ['pending', 'revoked', '', null, undefined, 'GRANTED']) assert.equal(isGranted(s), false);
});

test('홈 노출: granted가 아니면 show_on_home이 true여도 무시', () => {
  assert.equal(showsOnHome({ consent_status: 'granted', show_on_home: true }), true);
  assert.equal(showsOnHome({ consent_status: 'granted', show_on_home: false }), false);
  assert.equal(showsOnHome({ consent_status: 'pending', show_on_home: true }), false);
  assert.equal(showsOnHome({ consent_status: 'revoked', show_on_home: true }), false);
  assert.equal(showsOnHome({ show_on_home: true }), false);
});
