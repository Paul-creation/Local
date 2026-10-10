// 실행: npm test — BackLink 판정 (사이트 안 이동이면 history.back(), 아니면 fallback)
import test from 'node:test';
import assert from 'node:assert/strict';
import { isInSiteNav, pickFallback } from './backLink.ts';

const O = 'https://jamidunow.com';
const base = { clientNavs: 0, referrer: '', origin: O, historyLength: 1 };

test('이 문서에서 클라이언트 이동이 1회 이상이면 사이트 안 이동', () => {
  assert.equal(isInSiteNav({ ...base, clientNavs: 1 }), true);
  assert.equal(isInSiteNav({ ...base, clientNavs: 3, referrer: 'https://google.com/' }), true);
});

test('referrer가 같은 출처이고 history.length > 1이면 사이트 안 이동', () => {
  assert.equal(isInSiteNav({ ...base, referrer: `${O}/?r=1&players=2-2`, historyLength: 3 }), true);
});

test('새 탭으로 연 상세(history.length 1)는 referrer가 같은 출처여도 fallback으로', () => {
  assert.equal(isInSiteNav({ ...base, referrer: `${O}/`, historyLength: 1 }), false);
});

test('주소 직접 입력·북마크(referrer 없음)·검색엔진·다른 출처는 fallback으로', () => {
  assert.equal(isInSiteNav({ ...base, historyLength: 5 }), false);
  assert.equal(isInSiteNav({ ...base, referrer: 'https://www.google.com/', historyLength: 5 }), false);
  assert.equal(isInSiteNav({ ...base, referrer: 'https://jamidunow.com.evil.com/', historyLength: 5 }), false);
});

test('깨진 referrer는 안전하게 fallback으로', () => {
  assert.equal(isInSiteNav({ ...base, referrer: 'not a url', historyLength: 5 }), false);
});

test('pickFallback: preferList일 때만 저장된 목록 주소를 쓴다', () => {
  assert.equal(pickFallback('/', '/?r=1&players=2-2', true), '/?r=1&players=2-2');
  assert.equal(pickFallback('/', null, true), '/');
  assert.equal(pickFallback('/community', '/?r=1', false), '/community');
});
