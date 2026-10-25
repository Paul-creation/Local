// 실행: npm test — 스팀 근거 없는 대면·로컬 표현 검사
import test from 'node:test';
import assert from 'node:assert/strict';
import { inventedPlaystyle, filterActivities, hasLocalBasis } from './playstyle-guard.mjs';

test('로컬 근거가 없으면 대면·로컬·화면 분할·오프라인 표현을 잡음', () => {
  for (const t of ['친구와 대면 플레이', '로컬 협동', '같은 화면에서', '화면 분할로 즐긴다', '오프라인 모임']) {
    assert.ok(inventedPlaystyle(t, { has_local_coop: false }), t);
  }
  assert.equal(inventedPlaystyle('음성 채팅 협동', { has_local_coop: null }), null);
});

test('has_local_coop이거나 카테고리에 Local/Shared/Split Screen이 있으면 통과', () => {
  assert.equal(inventedPlaystyle('같은 화면 협동', { has_local_coop: true }), null);
  assert.equal(inventedPlaystyle('화면 분할', { has_local_coop: null }, ['Shared/Split Screen PvP']), null);
  assert.equal(hasLocalBasis({}, ['Online Co-op']), false);
});

test('활동 목록에서 근거 없는 항목만 뺌', () => {
  const r = filterActivities(['음성 채팅', '친구와 대면 플레이', '협동 탐험'], { has_local_coop: false });
  assert.deepEqual(r.kept, ['음성 채팅', '협동 탐험']);
  assert.deepEqual(r.removed, ['친구와 대면 플레이']);
});
