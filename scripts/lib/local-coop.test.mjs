// 실행: npm test — 스팀 카테고리로 has_local_coop 판정
import test from 'node:test';
import assert from 'node:assert/strict';
import { localCoopFromCategories as f } from './local-coop.mjs';

test('Shared/Split Screen Co-op이 있으면 true', () => {
  assert.equal(f(['Multi-player', 'Shared/Split Screen Co-op']), true);
  assert.equal(f(['Shared/Split Screen Co-op', 'Shared/Split Screen PvP']), true);
});

test('일반 Shared/Split Screen만 있으면 true (RE6·LEGO·아이작 유형)', () => {
  assert.equal(f(['Shared/Split Screen', 'Co-op']), true);
});

test('일반 Shared/Split Screen이 PvP와 함께면 false (한 화면 대전)', () => {
  assert.equal(f(['Shared/Split Screen', 'Shared/Split Screen PvP']), false);
});

test('관련 카테고리가 없으면 false', () => {
  assert.equal(f(['Online Co-op', 'Online PvP']), false);
  assert.equal(f([]), false);
});

test('이미 true인 값은 false로 내리지 않음', () => {
  assert.equal(f([], true), true);
  assert.equal(f(['Shared/Split Screen', 'Shared/Split Screen PvP'], true), true);
});
