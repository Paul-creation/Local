import test from 'node:test';
import assert from 'node:assert/strict';
import { parseTagModal, STORE_REGIONS } from './steam-tags.mjs';

test('parseTagModal: 태그 목록을 꺼냄', () => {
  const html = 'x InitAppTagModal( 2357570, [{"tagid":1,"name":"FPS","count":300,"browseable":true}], [], 0 ); y';
  assert.deepEqual(parseTagModal(html), [{ tagid: 1, name: 'FPS', count: 300, browseable: true }]);
});

test('parseTagModal: 태그 데이터가 없으면 null', () => {
  assert.equal(parseTagModal('<html>no tags</html>'), null);
});

test('한국 상점을 먼저, 그다음 미국 상점', () => {
  assert.deepEqual(STORE_REGIONS, ['kr', 'us']);
});
