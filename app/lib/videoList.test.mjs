// 실행: npm test — 상세 영상 목록 순서·자르기
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildVideoList, labelOf, MAX_VIDEOS, MAX_COOP, MAX_HIGHLIGHT } from './videoList.ts';

const coop = (id, view_count, channel_title = '채널') => ({ source: 'coop', video_id: id, title: id, channel_title, published_at: '2026-01-01T00:00:00Z', view_count });
const hl = (id, view_count = 0) => ({ source: 'highlight', video_id: id, title: id, channel_title: null, published_at: null, view_count });
const st = (id, streamer_name, tier, published_at = '2026-05-01T00:00:00Z') => ({ source: 'streamer', video_id: id, title: id, streamer_name, tier, published_at, view_count: null });
const ids = (list) => list.map((v) => v.video_id);

test('순서: 친구랑(조회수) → 하이라이트(조회수) → 스트리머 tier 1 → 2 → 3', () => {
  const list = buildVideoList([
    st('v3', 'A', 3), st('s2', 'B', 2), st('t1', 'C', 1),
    hl('h-low', 1), hl('h-high', 9),
    coop('c-low', 10), coop('c-high', 500),
  ]);
  assert.deepEqual(ids(list), ['c-high', 'c-low', 'h-high', 'h-low', 't1', 's2', 'v3']);
});

test('스트리머 같은 단계 안에서는 최근 영상이 앞', () => {
  const list = buildVideoList([st('old', 'A', 1, '2026-01-01T00:00:00Z'), st('new', 'B', 1, '2026-09-01T00:00:00Z')]);
  assert.deepEqual(ids(list), ['new', 'old']);
});

test('같은 video_id는 앞에 온 것 하나만 (친구랑이 스트리머보다 우선)', () => {
  const list = buildVideoList([st('x', 'A', 1), coop('x', 5), hl('x')]);
  assert.equal(list.length, 1);
  assert.match(list[0].label, /^멀티 플레이/);
});

test('스트리머 1명당 최대 2개 — 3개째는 건너뛰고 다른 스트리머가 채움', () => {
  const list = buildVideoList([st('a1', 'A', 1), st('a2', 'A', 1), st('a3', 'A', 1), st('b1', 'B', 1)]);
  assert.deepEqual(ids(list), ['a1', 'a2', 'b1']);
});

test('같은 사람이어도 이름이 다르면 따로 센다 (streamer_name 기준)', () => {
  const list = buildVideoList([st('a1', 'A', 1), st('a2', 'A', 2), st('a3', 'A', 3)]);
  assert.deepEqual(ids(list), ['a1', 'a2']);
});

test('vod는 전체 최대 2개', () => {
  const list = buildVideoList([st('v1', 'A', 3), st('v2', 'B', 3), st('v3', 'C', 3), st('t1', 'D', 1)]);
  assert.deepEqual(ids(list), ['t1', 'v1', 'v2']);
});

test('친구랑 플레이는 조회수 상위 3개, 하이라이트는 조회수 상위 2개까지만', () => {
  const list = buildVideoList([coop('c1', 1), coop('c2', 4), coop('c3', 3), coop('c4', 2), hl('h1', 1), hl('h2', 9), hl('h3', 5)]);
  assert.equal(MAX_COOP, 3);
  assert.equal(MAX_HIGHLIGHT, 2);
  assert.deepEqual(ids(list), ['c2', 'c3', 'c4', 'h2', 'h3']);
});

test('전체 최대 8개 — 친구랑 3 + 하이라이트 2 + 스트리머 영상 3개 자리', () => {
  const inputs = [coop('c1', 3), coop('c2', 2), coop('c3', 1), hl('h1', 3), hl('h2', 2), hl('h3', 1)];
  for (let i = 0; i < 6; i++) inputs.push(st(`s${i}`, `S${i}`, 1));
  const list = buildVideoList(inputs);
  assert.equal(list.length, MAX_VIDEOS);
  assert.deepEqual(ids(list), ['c1', 'c2', 'c3', 'h1', 'h2', 's0', 's1', 's2']);
});

test('입력이 비면 빈 목록, 원본 배열은 바꾸지 않음', () => {
  assert.deepEqual(buildVideoList([]), []);
  const input = [coop('a', 1), coop('b', 2)];
  buildVideoList(input);
  assert.deepEqual(ids(input), ['a', 'b']);
});

test('출처 문구', () => {
  assert.equal(labelOf(coop('x', 1, '침착맨')), '멀티 플레이 · 침착맨');
  assert.equal(labelOf(coop('x', 1, null)), '멀티 플레이');
  assert.equal(labelOf(hl('x')), '하이라이트');
  assert.equal(labelOf(st('x', '타요', 1)), '스트리머 · 타요');
  assert.equal(labelOf(st('x', '타요', 2)), '스트리머 · 타요 · 쇼츠');
  assert.equal(labelOf(st('x', '타요', 3)), '스트리머 · 타요 · 풀영상');
});
