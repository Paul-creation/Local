import test from 'node:test';
import assert from 'node:assert/strict';
import { suggestQuery } from './tagSuggestQuery.ts';

test('단어 하나면 그 단어', () => {
  assert.equal(suggestQuery(['협'], false), '협');
  assert.equal(suggestQuery([], false), '');
});

test('앞 단어가 태그가 아니면 입력 전체 — finals w가 w만으로 걸리지 않는다', () => {
  assert.equal(suggestQuery(['finals', 'w'], false), 'finals w');
});

test('태그를 이어 치는 중이면 마지막 단어, 영문·숫자 한 글자만 제외', () => {
  assert.equal(suggestQuery(['좀비', '협동'], true), '협동');
  assert.equal(suggestQuery(['좀비', '협'], true), '협'); // 한글 한 글자는 허용
  assert.equal(suggestQuery(['좀비', 'w'], true), ''); // 영문 한 글자는 막음
  assert.equal(suggestQuery(['좀비', '4'], true), ''); // 숫자 한 글자도 막음
});
