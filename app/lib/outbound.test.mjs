import test from 'node:test';
import assert from 'node:assert/strict';
import { parseInstagramUrl, makeRateLimiter, isUuid } from './outbound.ts';

test('인스타그램 https 주소만 통과', () => {
  assert.equal(parseInstagramUrl('https://www.instagram.com/p/abc/'), 'https://www.instagram.com/p/abc/');
  assert.equal(parseInstagramUrl('https://instagram.com/gamelog.archive'), 'https://instagram.com/gamelog.archive');
  for (const bad of ['http://instagram.com/x', 'https://evil.com/instagram.com', 'https://instagram.com.evil.com/x', 'javascript:alert(1)', 'nope', 42, null, 'https://instagram.com/' + 'a'.repeat(600)]) assert.equal(parseInstagramUrl(bad), null);
});

test('요청 제한: 창 안에서 한도 초과면 막고 창이 지나면 다시 허용', () => {
  const allow = makeRateLimiter(2, 1000);
  assert.ok(allow('a', 0)); assert.ok(allow('a', 10)); assert.ok(!allow('a', 20));
  assert.ok(allow('b', 20));
  assert.ok(allow('a', 1100));
});

test('uuid 검사', () => {
  assert.ok(isUuid('123e4567-e89b-12d3-a456-426614174000'));
  assert.ok(!isUuid('1; drop table'));
});
