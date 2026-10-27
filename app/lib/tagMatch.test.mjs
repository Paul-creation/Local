import test from 'node:test';
import assert from 'node:assert/strict';
import { matchesTags } from './tagMatch.ts';
import { eventHref, EVENTS } from './event.ts';

const owns = (...tags) => (t) => tags.includes(t);

test('match=any면 고른 태그 중 하나만 있어도(OR)', () => {
  assert.equal(matchesTags(['협동', '대전'], owns('협동'), true), true);
  assert.equal(matchesTags(['협동', '대전'], owns(), true), false);
});

test('match 없으면 고른 태그를 전부 가져야(AND)', () => {
  assert.equal(matchesTags(['협동', '대전'], owns('협동')), false);
  assert.equal(matchesTags(['협동', '대전'], owns('대전'), false), false);
  assert.equal(matchesTags(['협동', '대전'], owns('협동', '대전')), true);
  assert.equal(matchesTags([], owns()), true);
});

test('이벤트 링크는 match=any를 붙인다', () => {
  const sp = new URL(eventHref(EVENTS[0]), 'http://x').searchParams;
  assert.equal(sp.get('match'), 'any');
  assert.equal(sp.get('tags'), EVENTS[0].tags.join(','));
});
