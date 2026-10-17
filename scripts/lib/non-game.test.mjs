// 실행: npm test — 게임이 아닌 프로그램 판별 (장르 규칙 + 이름·카테고리 도구류 규칙)
import test from 'node:test';
import assert from 'node:assert/strict';
import { isNonGame } from './non-game.mjs';
import { judge } from './catalog-rules.mjs';

const crosshair = { genres: ['Action', 'Adventure', 'Indie', 'Software Training', 'Utilities'], name: 'Crosshair X', categories: ['Captions available', 'Steam Workshop', 'Steam Cloud'] };

test('장르만 보던 예전 규칙은 그대로', () => {
  assert.equal(isNonGame(['Indie', 'Utilities']), true); // Mouse X
  assert.equal(isNonGame(['RPG', 'Game Development']), true); // RPG Maker
  assert.equal(isNonGame(['Action', 'Adventure']), false);
  assert.equal(isNonGame(['Action', 'Utilities']), false); // 이름·카테고리를 모르면 도구류 규칙은 건너뜀
});

test('Crosshair X: 게임 장르가 붙어도 카테고리에 플레이 방식이 없으면 도구', () => {
  assert.equal(isNonGame(crosshair.genres, { name: crosshair.name, categories: crosshair.categories }), true);
});

test('이름에 도구 단어 + 소프트웨어 장르면 플레이 카테고리가 있어도 도구', () => {
  assert.equal(isNonGame(['Action', 'Utilities'], { name: 'FPS Monitor', categories: ['Single-player'] }), true);
  assert.equal(isNonGame(['Simulation', 'Utilities'], { name: 'Some Benchmark Suite', categories: ['Single-player'] }), true);
});

test('소프트웨어 장르가 없으면 이름에 overlay·benchmark가 있어도 게임', () => {
  assert.equal(isNonGame(['Action', 'Indie'], { name: 'Overlay Wars', categories: ['Single-player'] }), false);
  assert.equal(isNonGame(['Racing'], { name: 'Benchmark Racer', categories: [] }), false);
});

test('소프트웨어 장르가 있어도 싱글·멀티 카테고리가 있고 이름이 평범하면 게임', () => {
  assert.equal(isNonGame(['Simulation', 'Education'], { name: 'Typing Quest', categories: ['Single-player', 'Steam Cloud'] }), false);
  assert.equal(isNonGame(['Action', 'Utilities'], { name: 'Some Game', categories: ['Multi-player', 'Co-op'] }), false);
});

test('수집 기준(judge)이 Crosshair X를 동접 예외로도 못 통과시킴', () => {
  const info = { type: 'game', year: 2020, genres: crosshair.genres, reviews: 46321, positive: 0.93, name: crosshair.name, categories: crosshair.categories };
  assert.equal(judge(info).ok, false);
  assert.equal(judge(info, { ccu: 35000 }).ok, false);
  assert.equal(judge(info, { fromList: true, force: true }).ok, false);
});
