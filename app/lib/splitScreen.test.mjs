// 실행: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { hasSplitScreen } from './splitScreen.ts';

test('스팀 카테고리에 Shared/Split Screen이 있을 때만 화면 분할', () => {
  assert.equal(hasSplitScreen({ steam_categories: ['Co-op', 'Shared/Split Screen'] }), true);
  assert.equal(hasSplitScreen({ steam_categories: ['Co-op', 'Shared/Split Screen Co-op'] }), false);
  assert.equal(hasSplitScreen({ steam_categories: null }), false);
  assert.equal(hasSplitScreen({}), false);
});
