// 실행: npm test — 새 게임 수집 기준(인기 예외·연도 완화·force)
import test from 'node:test';
import assert from 'node:assert/strict';
import { judge, parseChart } from './catalog-rules.mjs';

const base = { type: 'game', year: 2020, genres: ['Action'], reviews: 5000, positive: 0.9 };

test('기본 기준: 리뷰 1,000개·긍정 65% 이상', () => {
  assert.equal(judge(base).ok, true);
  assert.equal(judge({ ...base, reviews: 999 }).ok, false);
  assert.equal(judge({ ...base, positive: 0.64 }).ok, false);
});

test('목록(--appids)은 긍정 60%까지, 연도 조건 없음', () => {
  assert.equal(judge({ ...base, positive: 0.62 }, { fromList: true }).ok, true);
  assert.equal(judge({ ...base, positive: 0.59 }, { fromList: true }).ok, false);
  assert.equal(judge({ ...base, year: 2012 }, { fromList: true }).ok, true);
});

test('연도 완화: 2013년 이전이라도 리뷰 10,000개 이상이면 통과', () => {
  assert.equal(judge({ ...base, year: 2012, reviews: 9999 }).ok, false);
  const r = judge({ ...base, year: 2012, reviews: 949607, positive: 0.97 });
  assert.equal(r.ok, true);
  assert.match(r.via, /연도 완화/);
  assert.equal(judge({ ...base, year: 2012, reviews: 949607 }, { legacy: true }).ok, false);
});

test('인기 예외: 동접 5,000 이상이면 긍정률·연도 면제, 리뷰 1,000개·종류·장르는 그대로', () => {
  const low = { ...base, positive: 0.5, year: 2012, reviews: 5000 };
  assert.equal(judge(low).ok, false);
  const r = judge(low, { ccu: 40280 });
  assert.equal(r.ok, true);
  assert.match(r.via, /동접 40,280/);
  assert.equal(judge(low, { ccu: 4999 }).ok, false);
  assert.equal(judge({ ...low, reviews: 500 }, { ccu: 40000 }).ok, false);
  assert.equal(judge({ ...low, type: 'mod' }, { ccu: 40000 }).ok, false);
  assert.equal(judge({ ...low, genres: ['Utilities'] }, { ccu: 40000 }).ok, false);
  assert.equal(judge(low, { ccu: 40000, legacy: true }).ok, false);
});

test('force: 긍정률·연도만 면제', () => {
  const low = { ...base, positive: 0.5, year: 2012 };
  assert.equal(judge(low, { fromList: true }).ok, false);
  assert.equal(judge(low, { fromList: true, force: true }).ok, true);
  assert.equal(judge({ ...low, reviews: 0 }, { fromList: true, force: true }).ok, false);
  assert.equal(judge({ ...low, type: 'dlc' }, { fromList: true, force: true }).ok, false);
});

test('출시일을 못 읽으면 연도 조건 통과 (예전과 같음)', () => {
  assert.equal(judge({ ...base, year: NaN }).ok, true);
  assert.equal(judge({ ...base, year: null }).ok, true);
});

test('parseChart: 공식 차트 응답 → appid별 동접', () => {
  const m = parseChart({ response: { ranks: [{ rank: 1, appid: 730, concurrent_in_game: 1000 }, { rank: 2, appid: 570, concurrent_in_game: 5 }] } });
  assert.equal(m.get('730'), 1000);
  assert.equal(m.size, 2);
  assert.equal(parseChart(null).size, 0);
  assert.equal(parseChart({ response: {} }).size, 0);
});

test('큐레이터 목록: 리뷰 수·긍정률·연도 면제, 출시 예정도 받고 종류·장르는 그대로', () => {
  const tiny = { ...base, reviews: 3, positive: 0.4, year: 2012 };
  assert.equal(judge(tiny, { fromList: true }).ok, false);
  assert.equal(judge(tiny, { fromList: true, curator: true }).ok, true);
  assert.equal(judge({ ...tiny, reviews: 0 }, { fromList: true, curator: true }).ok, true);
  assert.equal(judge({ ...tiny, comingSoon: true }, { fromList: true, curator: true }).ok, true);
  assert.equal(judge({ ...tiny, comingSoon: true, type: 'dlc' }, { fromList: true, curator: true }).ok, false);
  assert.equal(judge({ ...tiny, comingSoon: true }, { fromList: true }).ok, false); // 일반 목록(--appids)은 리뷰가 없어 그대로 제외
  assert.equal(judge({ ...tiny, type: 'dlc' }, { fromList: true, curator: true }).ok, false);
  assert.equal(judge({ ...tiny, genres: ['Sexual Content'] }, { fromList: true, curator: true }).ok, false);
  assert.equal(judge(tiny, { fromList: true, curator: true, legacy: true }).ok, false);
});

test('큐레이터 옵션이 없으면 일반 경로 기준 그대로 (출시 예정 표시도 영향 없음)', () => {
  assert.equal(judge({ ...base, reviews: 3 }).ok, false);
  assert.equal(judge({ ...base, comingSoon: true }).ok, true);
});
