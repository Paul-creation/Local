// 실행: npm test — 주간 스팀 협동 신작 후보 판정
import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeItem, firstPass, releasedQuality, secondPass, rankPassed, coopCategories } from './new-coop-rules.mjs';

const NOW = 1_800_000_000;
const DAY = 86400;
const item = (o = {}) => normalizeItem({ appid: 1, id: 1, name: 'G', success: 1, type: 0, categories: { supported_player_categoryids: [1, 9] }, reviews: { summary_filtered: { review_count: 50, percent_positive: 80 } }, release: { steam_release_date: NOW - 3 * DAY }, ...o });

test('협동·멀티 카테고리 id만 이름으로 바꿈', () => {
  assert.deepEqual(coopCategories({ categories: { supported_player_categoryids: [2, 1, 38, 49, 36] } }), ['Multi-player', 'Online Co-op', 'Online PvP']);
});
test('출시작: 14일 안이면 후보, 넘으면 탈락', () => {
  assert.equal(firstPass(item(), { nowTs: NOW }).kind, 'released');
  assert.equal(firstPass(item({ release: { steam_release_date: NOW - 15 * DAY } }), { nowTs: NOW }).drop, true);
});
test('DLC·소프트웨어(type != 0)와 협동 카테고리 없는 게임은 탈락', () => {
  assert.equal(firstPass(item({ type: 4 }), { nowTs: NOW }).drop, true);
  assert.equal(firstPass(item({ categories: { supported_player_categoryids: [2] } }), { nowTs: NOW }).reason, '협동·멀티 카테고리 없음');
});
test('출시 예정: 인기 순위 안이면 후보, 밖이면 탈락', () => {
  const up = item({ is_coming_soon: true, release: { steam_release_date: NOW + 30 * DAY, is_coming_soon: true } });
  assert.equal(firstPass(up, { nowTs: NOW, rank: 5 }).kind, 'upcoming');
  assert.equal(firstPass(up, { nowTs: NOW, rank: 80 }).drop, true);
  assert.equal(firstPass(up, { nowTs: NOW }).drop, true);
});
test('출시작 품질: 리뷰 20개 또는 동접 100명', () => {
  assert.equal(releasedQuality(item(), null).ok, true);
  const low = item({ reviews: { summary_filtered: { review_count: 5, percent_positive: 90 } } });
  assert.equal(releasedQuality(low, 99).ok, false);
  assert.equal(releasedQuality(low, 100).ok, true);
});
test('성인 표시·제외 장르 탈락', () => {
  assert.equal(secondPass({ type: 'game', content_descriptors: { ids: [3] }, genres: [], categories: [] }).ok, false);
  assert.equal(secondPass({ type: 'game', content_descriptors: { ids: [2, 5] }, genres: [{ description: 'Action' }], categories: [{ description: 'Co-op' }], name: 'X' }).ok, true);
  assert.equal(secondPass({ type: 'game', genres: [{ description: 'Utilities' }], categories: [] }).ok, false);
});
test('주 최대 개수로 자름', () => {
  const list = Array.from({ length: 40 }, (_, i) => ({ kind: 'released', reviews: i, ccu: 0 }));
  assert.equal(rankPassed(list, 30).length, 30);
  assert.equal(rankPassed(list, 30)[0].reviews, 39);
});
test('정렬: 리뷰 많은 출시작이 순위 낮은 출시 예정작보다 앞', () => {
  const out = rankPassed([{ kind: 'upcoming', rank: 30, reviews: 0 }, { kind: 'released', reviews: 3000, ccu: 0 }, { kind: 'released', reviews: 20, ccu: 0 }], 3);
  assert.deepEqual(out.map((x) => x.kind + (x.reviews || '')), ['released3000', 'upcoming', 'released20']);
});
