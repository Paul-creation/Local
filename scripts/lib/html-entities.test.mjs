// 실행: npm test — enrich-specs 저장 전 HTML 엔티티 디코딩
import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeEntities } from './html-entities.mjs';

test('엔티티를 풀어 쓴다', () => {
  assert.equal(decodeEntities('equivalent performance &amp; VRAM'), 'equivalent performance & VRAM');
  assert.equal(decodeEntities('&quot;Ultra&quot; &gt; High &lt; Low'), '"Ultra" > High < Low');
  assert.equal(decodeEntities('Portal&reg; &#39;x&#39; &#x41;'), "Portal® 'x' A");
});
test('한 번만 푼다(이중 인코딩을 더 풀지 않음)·모르는 엔티티는 그대로', () => {
  assert.equal(decodeEntities('&amp;lt;'), '&lt;');
  assert.equal(decodeEntities('&foo; AT&T'), '&foo; AT&T');
});
