import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { NEW_GAME_STEPS, stepArgs, parseIdsArg } from './new-game-steps.mjs';

const names = NEW_GAME_STEPS.map((s) => s[0]);

test('모든 단계의 스크립트 파일이 있다', () => { for (const n of names) assert.ok(fs.existsSync(`scripts/${n}.mjs`), n); });
test('꼭 필요한 단계가 들어 있다', () => {
  for (const n of ['backfill-steam-categories', 'link-new-game-tags', 'judge-new-games', 'enrich-specs', 'fix-data-gaps', 'write-fun-descriptions', 'fill-activities-v2']) assert.ok(names.includes(n), n);
});
test('스팀 카테고리는 판단·AI 단계보다 먼저', () => {
  const at = (n) => names.indexOf(n);
  assert.ok(at('backfill-steam-categories') < at('judge-new-games'));
  assert.ok(at('judge-new-games') < at('write-fun-descriptions'));
});
test('인자 치환', () => {
  const o = { idsFile: 'a.json', funIdsFile: 'b.json', days: 14 };
  assert.deepEqual(stepArgs(['judge-new-games', '--apply', '--days', 'DAYS', 'IDS'], o), ['judge-new-games', ['--apply', '--days', '14', '--ids', 'a.json']]);
  assert.deepEqual(stepArgs(['write-fun-descriptions', '--ids-file', 'FUN_IDS'], o), ['write-fun-descriptions', ['--ids-file', 'b.json']]);
});
test('--ids는 쉼표 목록·JSON 파일 둘 다', () => {
  assert.deepEqual(parseIdsArg('a, b', null), ['a', 'b']);
  assert.deepEqual(parseIdsArg('x.json', () => '[{"id":"a"},"b",{"game_id":"c"}]'), ['a', 'b', 'c']);
  assert.equal(parseIdsArg(null, null), null);
});
