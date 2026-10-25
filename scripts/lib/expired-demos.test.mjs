// 실행: npm test — 내려간 데모 판정
import test from 'node:test';
import assert from 'node:assert/strict';
import { parentListsDemo, demoGone, judgeDemo } from './expired-demos.mjs';

const parent = (demos) => ({ success: true, data: { demos } });

test('부모 demos[]에 있으면 true, 없거나 비면 false (번호는 문자열·숫자 모두 비교)', () => {
  assert.equal(parentListsDemo(parent([{ appid: 4000111 }]), '4000111'), true);
  assert.equal(parentListsDemo(parent([{ appid: 1 }]), '4000111'), false);
  assert.equal(parentListsDemo(parent([]), '4000111'), false);
  assert.equal(parentListsDemo({ success: true, data: {} }, '4000111'), false);
});

test('부모 응답이 실패거나 없으면 null', () => {
  assert.equal(parentListsDemo({ success: false }, '1'), null);
  assert.equal(parentListsDemo(undefined, '1'), null);
});

test('데모 appdetails: success:false만 내려간 것, 응답 없음은 모름', () => {
  assert.equal(demoGone({ success: false }), true);
  assert.equal(demoGone({ success: true, data: {} }), false);
  assert.equal(demoGone(undefined), null);
});

test('판정: 부모에 없으면 expired, 부모에 있으면 데모가 success:false일 때만 expired', () => {
  assert.equal(judgeDemo(parent([]), '9', undefined), 'expired');
  assert.equal(judgeDemo(parent([{ appid: 9 }]), '9', { success: false }), 'expired');
  assert.equal(judgeDemo(parent([{ appid: 9 }]), '9', { success: true, data: {} }), 'alive');
  assert.equal(judgeDemo(parent([{ appid: 9 }]), '9', undefined), 'alive');
});

test('판정: 부모 요청이 실패하면 skip (데모 응답이 실패여도 판정 안 함)', () => {
  assert.equal(judgeDemo({ success: false }, '9', { success: false }), 'skip');
  assert.equal(judgeDemo(undefined, '9', undefined), 'skip');
});
