// 실행: npm test — /my-pc?back= 돌아가기 주소 검사 (같은 사이트 경로만)
import test from 'node:test';
import assert from 'node:assert/strict';
import { safeBackPath } from './backPath.ts';

test('같은 사이트 경로는 그대로 통과', () => {
  for (const ok of ['/', '/games/abc-123', '/?players=2-2&mypc=1', '/games/abc#spec', '/wishlist?ids=a,b']) assert.equal(safeBackPath(ok), ok);
});

test('프로토콜·"//"·백슬래시는 거부', () => {
  for (const bad of ['//evil.com', '//evil.com/x', 'https://evil.com', 'http://evil.com/', 'javascript:alert(1)', 'data:text/html,x', '/\\evil.com', '\\\\evil.com', 'evil.com', 'games/abc', '']) assert.equal(safeBackPath(bad), null, JSON.stringify(bad));
});

test('탭·줄바꿈 등 제어문자로 "//"를 숨기는 시도는 거부', () => {
  for (const bad of ['/\t/evil.com', '/\n/evil.com', '/\r/evil.com', '/\u0000x', '/a\u007fb']) assert.equal(safeBackPath(bad), null, JSON.stringify(bad));
});

test('비었거나 문자열이 아니거나 너무 길면 거부', () => {
  assert.equal(safeBackPath(null), null);
  assert.equal(safeBackPath(undefined), null);
  assert.equal(safeBackPath(123), null);
  assert.equal(safeBackPath('/' + 'a'.repeat(600)), null);
});
