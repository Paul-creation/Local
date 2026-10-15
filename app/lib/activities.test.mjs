// 실행: npm test (Node 내장 테스트, .ts를 바로 불러온다)
import test from 'node:test';
import assert from 'node:assert/strict';
import { ACTIVITIES, ACTIVITY_GROUPS, ACTIVITY_KEYS, activityLabel, isActivityKey } from './activities.ts';

test('키·라벨은 겹치지 않고 모든 칸이 채워져 있다', () => {
  assert.equal(new Set(ACTIVITY_KEYS).size, ACTIVITIES.length);
  assert.equal(new Set(ACTIVITIES.map((a) => a.label)).size, ACTIVITIES.length);
  for (const a of ACTIVITIES) {
    assert.match(a.key, /^[a-z_]+$/);
    assert.ok(a.label && a.def && a.check, a.key);
    assert.ok(ACTIVITY_GROUPS.includes(a.group), a.key);
  }
});

test('모드·장르성 키는 없고 새 키는 있다', () => {
  for (const k of ['story', 'rpg_grow', 'roguelike', 'strategy', 'compete_rank']) assert.equal(isActivityKey(k), false, k);
  for (const k of ['sports', 'music', 'photo', 'horror_scare', 'drive', 'train', 'dialogue_choice']) assert.equal(isActivityKey(k), true, k);
});

test('보스 레이드 키의 라벨은 "보스전"', () => {
  assert.equal(activityLabel('boss_raid'), '보스전');
  assert.equal(activityLabel('dialogue_choice'), '대화·선택지');
});

test('라벨 조회: 모르는 키는 그대로 돌려준다', () => {
  assert.equal(activityLabel('drive'), '운전');
  assert.equal(activityLabel('nope'), 'nope');
});
