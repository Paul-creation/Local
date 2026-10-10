// 실행: npm test — 스트리머 칩 대표 영상 고르기
import test from 'node:test';
import assert from 'node:assert/strict';
import { pickStreamerVideo, tierOf } from './streamerPick.ts';

const r = (video_id, kind, is_short = false) => ({ video_id, kind, is_short });

test('단계: main·edit·game 쇼츠 아님 1, 쇼츠 2, vod 3', () => {
  assert.equal(tierOf('main', false), 1);
  assert.equal(tierOf('edit', false), 1);
  assert.equal(tierOf('game', false), 1);
  assert.equal(tierOf('main', true), 2);
  assert.equal(tierOf('vod', false), 3);
  assert.equal(tierOf('vod', true), 3);
});

test('vod가 더 최근이어도 main 영상이 있으면 main', () => {
  assert.deepEqual(pickStreamerVideo([r('vodNew', 'vod'), r('mainOld', 'main')]), { videoId: 'mainOld', full: false });
});

test('main 쇼츠보다 main 긴 영상 우선, 같은 단계에서는 최근(앞) 영상', () => {
  assert.deepEqual(pickStreamerVideo([r('s', 'main', true), r('a', 'game'), r('b', 'main')]), { videoId: 'a', full: false });
});

test('쇼츠뿐이면 쇼츠, 그래도 vod보다 앞', () => {
  assert.deepEqual(pickStreamerVideo([r('v', 'vod'), r('s', 'main', true)]), { videoId: 's', full: false });
});

test('vod뿐이면 vod 영상 + full', () => {
  assert.deepEqual(pickStreamerVideo([r('v1', 'vod'), r('v2', 'vod')]), { videoId: 'v1', full: true });
});

test('영상이 없으면 null', () => {
  assert.equal(pickStreamerVideo([]), null);
});
