// 실행: npm test — 스팀 근거 없는 대면·로컬 표현 검사
import test from 'node:test';
import assert from 'node:assert/strict';
import { inventedPlaystyle, filterActivities, hasLocalBasis } from './playstyle-guard.mjs';

const none = { has_local_coop: false, steam_categories: ['Multi-player', 'Online Co-op'] };

test('로컬 근거가 없으면 대면·로컬·화면 분할·오프라인 표현을 잡음', () => {
  for (const t of ['친구와 대면 플레이', '대면으로 즐긴다', '마주앉아 하는', '로컬 협동', '같은 화면에서', '화면 분할로 즐긴다', '오프라인 모임']) {
    assert.ok(inventedPlaystyle(t, none), t);
  }
  assert.equal(inventedPlaystyle('음성 채팅 협동', none), null);
});

test('"최종 대면" 같은 문장은 걸리지 않음', () => {
  assert.equal(inventedPlaystyle('최종 보스와 대면한다', none), null);
  assert.equal(inventedPlaystyle('공포와 대면하는 협동', none), null);
});

test('steam_categories에 Local·Shared/Split Screen(협동·대전 모두)이 있으면 통과', () => {
  assert.equal(inventedPlaystyle('로컬 대전', { steam_categories: ['Shared/Split Screen PvP'] }), null);
  assert.equal(inventedPlaystyle('화면 분할', { steam_categories: ['Shared/Split Screen'] }), null);
  assert.equal(inventedPlaystyle('같은 화면 협동', { has_local_coop: true }), null);
  assert.equal(hasLocalBasis({ steam_categories: ['Online Co-op'] }), false);
  assert.equal(hasLocalBasis({ steam_categories: null }), false);
});

test('활동 목록에서 근거 없는 항목만 뺌', () => {
  const r = filterActivities(['음성 채팅', '친구와 대면 플레이', '협동 탐험'], none);
  assert.deepEqual(r.kept, ['음성 채팅', '협동 탐험']);
  assert.deepEqual(r.removed, ['친구와 대면 플레이']);
});
