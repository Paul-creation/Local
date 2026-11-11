import test from 'node:test';
import assert from 'node:assert/strict';
import { playTime, hoursText } from './playTime.ts';

const H = 3600;

test('순서가 맞으면 빠르게·보통·전부', () => {
  const r = playTime({ solo_mode: 'story', ttb_hastily: 8 * H, ttb_normally: 11 * H, ttb_completely: 20 * H });
  assert.deepEqual(r, { label: '플레이 시간', kind: 'hours', normally: 11 * H, hastily: 8 * H, completely: 20 * H });
});

test('순서가 어긋나도 보통값은 버리지 않고 보통만 보여 준다', () => {
  const r = playTime({ solo_mode: 'story', ttb_hastily: 12 * H, ttb_normally: 11 * H, ttb_completely: 9 * H });
  assert.deepEqual(r, { label: '플레이 시간', kind: 'hours', normally: 11 * H });
  assert.deepEqual(playTime({ ttb_hastily: 5 * H, ttb_normally: 4 * H }), { label: '플레이 시간', kind: 'hours', normally: 4 * H });
});

test('멀티 전용은 함께 클리어까지 — It Takes Two 15시간', () => {
  const r = playTime({ solo_mode: 'none', ttb_hastily: 12 * H, ttb_normally: 15 * H, ttb_completely: 20 * H });
  assert.deepEqual(r, { label: '함께 클리어까지', kind: 'hours', normally: 15 * H });
  assert.equal(hoursText(r.normally), '15시간');
});

test('ttb가 없으면 story_length 문구 (멀티 전용이면 함께 클리어까지)', () => {
  assert.deepEqual(playTime({ solo_mode: 'story', story_length: '약 10시간' }), { label: '플레이 시간', kind: 'text', text: '약 10시간' });
  assert.deepEqual(playTime({ solo_mode: 'none', story_length: '약 6시간' }), { label: '함께 클리어까지', kind: 'text', text: '약 6시간' });
});

test('값이 하나도 없으면 타일 없음', () => {
  assert.equal(playTime({ solo_mode: 'none' }), null);
  assert.equal(playTime({ ttb_normally: 0 }), null);
});
