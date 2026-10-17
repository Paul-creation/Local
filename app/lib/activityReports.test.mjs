import test from 'node:test';
import assert from 'node:assert/strict';
const ORDER = ['drive', 'fish', 'build'];
import { applyApproval, reportable, groupReports } from './activityReports.ts';

test('빠진 활동 승인 — 확정에 분류표 순서로 추가, 확인 중에서는 뺌', () => {
  assert.deepEqual(applyApproval('missing', 'drive', ['build'], ['drive', 'fish'], ORDER), { confirmed: ['drive', 'build'], unsure: ['fish'] });
  assert.deepEqual(applyApproval('missing', 'drive', ['drive'], [], ORDER), { confirmed: ['drive'], unsure: [] });
});

test('틀린 활동 승인 — 확정이면 확인 중으로, 확인 중이면 그냥 뺌', () => {
  assert.deepEqual(applyApproval('wrong', 'drive', ['drive', 'build'], ['fish'], ORDER), { confirmed: ['build'], unsure: ['drive', 'fish'] });
  assert.deepEqual(applyApproval('wrong', 'fish', ['build'], ['fish'], ORDER), { confirmed: ['build'], unsure: [] });
});

test('제보 가능 여부 — 빠진 건 확정에 없어야, 틀린 건 지금 보이는 칩이어야', () => {
  assert.equal(reportable('missing', 'drive', ['drive'], []), false);
  assert.equal(reportable('missing', 'drive', [], ['drive']), true);
  assert.equal(reportable('wrong', 'drive', [], ['drive']), true);
  assert.equal(reportable('wrong', 'drive', ['build'], []), false);
});

test('묶기 — 3명 이상이 위로, 그다음 많은 순', () => {
  const r = (g, k, n) => Array.from({ length: n }, (_, i) => ({ game_id: g, activity_key: k, kind: 'missing', created_at: `2026-10-0${i + 1}` }));
  const out = groupReports([...r('a', 'fish', 2), ...r('b', 'drive', 3), ...r('c', 'farm', 1)]);
  assert.deepEqual(out.map((g) => [g.gameId, g.count]), [['b', 3], ['a', 2], ['c', 1]]);
});
