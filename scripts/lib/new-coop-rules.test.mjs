// 실행: npm test — 주간 스팀 협동 신작 후보 판정
import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeItem, firstPass, releasedQuality, secondPass, rankPassed, coopCategories } from './new-coop-rules.mjs';

const NOW = 1_800_000_000;
const DAY = 86400;
const item = (o = {}) => normalizeItem({ appid: 1, id: 1, name: 'G', success: 1, type: 0, categories: { supported_player_categoryids: [1, 9] }, reviews: { summary_filtered: { review_count: 50, percent_positive: 80 } }, release: { steam_release_date: NOW - 3 * DAY }, ...o });

test('협동·온라인 협동 id만 이름으로 바꿈 (멀티·PvP는 제외)', () => {
  assert.deepEqual(coopCategories({ categories: { supported_player_categoryids: [2, 1, 38, 49, 36, 9] } }), ['Online Co-op', 'Co-op']);
});
test('출시작: 14일 안이면 후보, 넘으면 탈락, 기간 옵션 반영', () => {
  assert.equal(firstPass(item(), { nowTs: NOW }).kind, 'released');
  const old = item({ release: { steam_release_date: NOW - 20 * DAY } });
  assert.equal(firstPass(old, { nowTs: NOW }).drop, true);
  assert.equal(firstPass(old, { nowTs: NOW, windowDays: 30 }).kind, 'released');
});
test('DLC·소프트웨어(type != 0)와 협동 카테고리 없는 게임(멀티·PvP만)은 탈락', () => {
  assert.equal(firstPass(item({ type: 4 }), { nowTs: NOW }).drop, true);
  assert.equal(firstPass(item({ categories: { supported_player_categoryids: [1, 36, 49] } }), { nowTs: NOW }).reason, '협동·온라인 협동 카테고리 없음');
});
test('출시 예정: 순위 30위 안 + 출시일 60일 안이면 후보', () => {
  const up = (days, o = {}) => item({ is_coming_soon: true, release: { steam_release_date: NOW + days * DAY, is_coming_soon: true }, ...o });
  assert.equal(firstPass(up(30), { nowTs: NOW, rank: 5 }).kind, 'upcoming');
  assert.equal(firstPass(up(30), { nowTs: NOW, rank: 31 }).drop, true);
  assert.equal(firstPass(up(30), { nowTs: NOW }).drop, true);
  assert.equal(firstPass(up(61), { nowTs: NOW, rank: 5 }).drop, true);
  assert.equal(firstPass(up(60), { nowTs: NOW, rank: 5 }).kind, 'upcoming');
  assert.equal(firstPass(up(10, { release: { is_coming_soon: true } }), { nowTs: NOW, rank: 5 }).reason, '출시 예정 · 출시일 모름');
});
test('출시작 품질: 리뷰 50개 이상', () => {
  assert.equal(releasedQuality(item({ reviews: { summary_filtered: { review_count: 50, percent_positive: 90 } } })).ok, true);
  assert.equal(releasedQuality(item({ reviews: { summary_filtered: { review_count: 49, percent_positive: 90 } } })).ok, false);
});
test('성인 표시·제외 장르 탈락', () => {
  assert.equal(secondPass({ type: 'game', content_descriptors: { ids: [3] }, genres: [], categories: [] }).ok, false);
  assert.equal(secondPass({ type: 'game', content_descriptors: { ids: [2, 5] }, genres: [{ description: 'Action' }], categories: [{ description: 'Co-op' }], name: 'X' }).ok, true);
  assert.equal(secondPass({ type: 'game', genres: [{ description: 'Utilities' }], categories: [] }).ok, false);
});
test('상한: 출시작은 리뷰 많은 순, 출시 예정작은 출시일 가까운 순, 출시 예정 최소 자리', () => {
  const rel = Array.from({ length: 40 }, (_, i) => ({ kind: 'released', reviews: 50 + i }));
  const up = Array.from({ length: 15 }, (_, i) => ({ kind: 'upcoming', releaseTs: 100 - i }));
  const out = rankPassed([...rel, ...up], 30, 10);
  assert.equal(out.length, 30);
  assert.equal(out.filter((x) => x.kind === 'upcoming').length, 10);
  assert.equal(out[0].reviews, 89);
  assert.equal(out.find((x) => x.kind === 'upcoming').releaseTs, 86); // 가장 가까운 출시일
  const few = rankPassed([...rel.slice(0, 5), ...up], 30, 10);
  assert.equal(few.length, 20); // 둘 다 모자라면 있는 만큼
  const mostlyUp = rankPassed([...rel.slice(0, 5), ...Array.from({ length: 40 }, (_, i) => ({ kind: 'upcoming', releaseTs: i }))], 30, 10);
  assert.equal(mostlyUp.filter((x) => x.kind === 'upcoming').length, 25); // 출시작이 모자라면 남는 자리까지
});
