// 실행: npm test — 인원별 추천 "인기 급상승" 규칙 (동접 증가율·리뷰 속도·스트리머 감쇠·칸 분류·배지·슬롯 뽑기)
import test from 'node:test';
import assert from 'node:assert/strict';
import { median, playerGrowth, reviewSpeed, streamerSum, classify, pickSlots, pickDaily, RISING_SLOTS, NEW_SLOTS } from './trending.ts';

const s = (age, count) => ({ age, count });

test('median: 홀수·짝수·빈 배열', () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([4, 1, 3, 2]), 2.5);
  assert.equal(median([]), null);
});

test('동접 증가율: 최근 3일 중앙값 ÷ 7일 전 같은 3일 중앙값 (요일 맞춤)', () => {
  const g = playerGrowth([s(0.5, 300), s(1.5, 300), s(2.5, 300), s(7.5, 100), s(8.5, 100), s(9.5, 100), s(5, 9999)]);
  assert.deepEqual(g, { gp: 3 });
});

test('동접 증가율: 7일 전 같은 구간에 기록 있는 날이 2일 미만이면 null (4~11일 전 대체 없음)', () => {
  assert.equal(playerGrowth([s(0.5, 200), s(1.5, 200), s(2.5, 200), s(5, 100), s(6, 100), s(8, 100)]), null); // 7~10일 전은 8일 1개뿐
  assert.equal(playerGrowth([s(0.5, 200), s(1.5, 200), s(2.5, 200), s(5, 100), s(6, 100), s(6.5, 100)]), null); // 7~10일 전 없음
  assert.equal(playerGrowth([s(0.5, 200), s(1.5, 200), s(2.5, 200), s(8.2, 100), s(8.4, 100), s(8.6, 100)]), null); // 같은 날에 세 번 기록돼도 1일
});

test('동접 증가율: 최근 3일에 기록 있는 날이 2일 미만이면 null', () => {
  assert.equal(playerGrowth([s(0.5, 200), s(7.5, 100), s(8.5, 100), s(9.5, 100)]), null);       // 1일만
  assert.equal(playerGrowth([s(0.3, 200), s(0.8, 200), s(7.5, 100), s(8.5, 100)]), null);       // 같은 날 두 번 = 1일
  assert.equal(playerGrowth([s(3.5, 200), s(4, 200), s(7.5, 100), s(8.5, 100)]), null);         // 최근 3일 안에 기록 없음
});

test('동접 증가율: 기록이 아예 없으면 null', () => {
  assert.equal(playerGrowth([]), null);
});

test('동접 증가율: 2일씩이면 계산 (경계 age 3·7·10 포함 규칙)', () => {
  assert.deepEqual(playerGrowth([s(1.5, 300), s(3, 300), s(7.01, 100), s(10, 100)]), { gp: 3 });
  assert.equal(playerGrowth([s(1.5, 300), s(3, 300), s(7, 100), s(10, 100)]), null); // 정확히 7일 전은 구간 밖
});

test('동접 증가율: 0값은 기록 실패로 보고 없는 값 취급 (분모 0 폭주·중앙값 왜곡 방지)', () => {
  // 7일 전 3일 중 2일이 0 → 유효한 날 1일 → null
  assert.equal(playerGrowth([s(0.5, 300), s(1.5, 300), s(7.5, 100), s(8.5, 0), s(9.5, 0)]), null);
  // 최근 값이 0이어도 유효한 날이 2일이면 0은 빼고 계산
  assert.deepEqual(playerGrowth([s(0.5, 0), s(1.5, 300), s(2.5, 300), s(7.5, 100), s(8.5, 100)]), { gp: 3 });
  // 전부 0
  assert.equal(playerGrowth([s(0.5, 0), s(1.5, 0), s(7.5, 0), s(8.5, 0)]), null);
});

test('동접 증가율: 분모는 50 아래로 내려가지 않는다', () => {
  assert.equal(playerGrowth([s(0.5, 100), s(1.5, 100), s(7.5, 5), s(8.5, 5)]).gp, 2);
});

test('동접 증가율: 하루 두 번 기록돼도 중앙값은 기록 전체로 (요일 맞춘 3일)', () => {
  const g = playerGrowth([s(0.5, 600), s(1.5, 600), s(2.5, 600), s(8.2, 100), s(8.4, 300), s(9.5, 300)]);
  assert.equal(g.gp, 2);
});

test('리뷰 속도: 평생 평균 대비 배율, 최근 리뷰 30개 미만이면 null', () => {
  assert.ok(Math.abs(reviewSpeed(100, 1000, 300) - 1) < 1e-9); // 30/300 = 0.1 = 100/1000 → 평균과 같음
  assert.ok(Math.abs(reviewSpeed(300, 1000, 300) - 3) < 1e-9);
  assert.equal(reviewSpeed(1000, 1000, 10), 1);         // 나이가 30일 미만이면 비율을 그대로
  assert.equal(reviewSpeed(29, 1000, 300), null);
  assert.equal(reviewSpeed(null, 1000, 300), null);
  assert.equal(reviewSpeed(100, 0, 300), null);
  assert.equal(reviewSpeed(100, 1000, null), null);
});

test('스트리머 합: 오늘 1, 7일 0.5, 14일 이상 0 (선형 감쇠)', () => {
  assert.equal(streamerSum([]), 0);
  assert.equal(streamerSum([0]), 1);
  assert.equal(streamerSum([7]), 0.5);
  assert.equal(streamerSum([14, 20]), 0);
  assert.ok(Math.abs(streamerSum([0, 7, 14]) - 1.5) < 1e-9);
  assert.equal(streamerSum([-1]), 1); // 시계 차이로 미래 시각이 와도 1을 넘지 않음
});

const base = { current: 5000, ageDays: 1000, reviewTotal: 50000, recentReviews: 500, gp: 1.6, streamer: 0 };

test('분류: 동접 300 미만은 후보 아님', () => {
  assert.equal(classify({ ...base, current: 299 }), null);
  assert.equal(classify({ ...base, current: null }), null);
});

test('재부상은 현재 동접 1,000 이상만 (신작은 300 유지)', () => {
  assert.equal(classify({ ...base, current: 999, gp: 5 }), null);
  assert.equal(classify({ ...base, current: 1000, gp: 5 }).kind, 'rising');
  assert.equal(classify({ current: 300, ageDays: 10, reviewTotal: 100, recentReviews: 50, gp: null, streamer: 0 }).kind, 'new');
});

test('동접 10만 이상 큰 게임은 증가율 2.5 이상일 때만 후보 (배지도 그때만)', () => {
  assert.equal(classify({ ...base, current: 100000, gp: 2.49 }), null);
  assert.deepEqual(classify({ ...base, current: 100000, gp: 2.5 }).badges, ['다시 뜨는 중']);
  assert.equal(classify({ ...base, current: 99999, gp: 1.6 }).kind, 'rising');
});

test('분류: 재부상은 증가율 1.2 이상만 (1.2 포함), 없거나 낮으면 제외', () => {
  assert.equal(classify({ ...base, gp: 1.19 }), null);
  assert.equal(classify({ ...base, gp: null }), null);
  assert.equal(classify({ ...base, gp: 1.2 }).kind, 'rising');
});

test('배지: "다시 뜨는 중"은 출시 1년 이상 + 증가율 1.5 이상', () => {
  assert.deepEqual(classify({ ...base, gp: 1.5 }).badges, ['다시 뜨는 중']);
  assert.deepEqual(classify({ ...base, gp: 1.49 }).badges, []);
  assert.deepEqual(classify({ ...base, gp: 3, ageDays: null }).badges, []);
});

test('배지: 출시 91~364일은 증가율 1.5 이상일 때 "요즘 뜨는 중" (경계 포함)', () => {
  assert.deepEqual(classify({ ...base, gp: 1.5, ageDays: 364 }).badges, ['요즘 뜨는 중']);
  assert.deepEqual(classify({ ...base, gp: 1.5, ageDays: 365 }).badges, ['다시 뜨는 중']);
  assert.deepEqual(classify({ ...base, gp: 1.5, ageDays: 91 }).badges, ['요즘 뜨는 중']);
  assert.deepEqual(classify({ ...base, gp: 1.49, ageDays: 200 }).badges, []);
  assert.deepEqual(classify({ ...base, gp: 3, ageDays: 200, streamer: 3 }).badges, ['요즘 뜨는 중', '스트리머 화제']);
  assert.deepEqual(classify({ ...base, gp: 3, ageDays: 60, reviewTotal: 560000 }).badges, []); // 90일 이내 큰 게임(신작 아님)은 해당 없음
});

test('리뷰 속도는 점수만 올리고 후보 조건·배지에는 안 쓴다', () => {
  const slow = classify({ ...base, gp: 1.3, recentReviews: 10 });
  const fast = classify({ ...base, gp: 1.3, recentReviews: 5000 });
  assert.equal(slow.kind, 'rising');
  assert.deepEqual(slow.badges, fast.badges);
  assert.ok(fast.score > slow.score);
  assert.equal(classify({ ...base, gp: 1.1, recentReviews: 50000 }), null); // 리뷰가 아무리 빨라도 증가율 미달이면 제외
});

test('신작: 출시 90일 이내 + 리뷰 10만 미만 (경계 포함/제외)', () => {
  const n = { ...base, ageDays: 90, reviewTotal: 99999, gp: null };
  assert.equal(classify(n).kind, 'new');
  assert.deepEqual(classify(n).badges, ['신작']);
  assert.equal(classify({ ...n, ageDays: 91 }), null);              // 91일, 증가율 없음 → 어느 칸도 아님
  assert.equal(classify({ ...n, reviewTotal: 100000 }), null);      // 리뷰 10만 이상은 신작이 아님 (증가율 없으면 재부상도 아님)
  assert.equal(classify({ ...n, ageDays: -5 }), null);              // 아직 출시 전
  assert.equal(classify({ ...n, reviewTotal: null }).kind, 'new'); // 리뷰 수를 모르면 0으로 봄
});

test('신작이 아닌 큰 최근작(리뷰 10만 이상)은 증가율이 되면 재부상 칸 (배지는 1년 이상일 때만)', () => {
  const t = classify({ ...base, ageDays: 60, reviewTotal: 560000, gp: 1.4 });
  assert.equal(t.kind, 'rising');
  assert.deepEqual(t.badges, []);
});

test('스트리머 화제: 14일 가중 합 3 이상, 신작·재부상 둘 다 붙을 수 있음', () => {
  assert.deepEqual(classify({ ...base, gp: 1.6, streamer: 3 }).badges, ['다시 뜨는 중', '스트리머 화제']);
  assert.deepEqual(classify({ ...base, gp: 1.6, streamer: 2.99 }).badges, ['다시 뜨는 중']);
  assert.deepEqual(classify({ ...base, ageDays: 10, gp: null, reviewTotal: 100, streamer: 3 }).badges, ['신작', '스트리머 화제']);
});

test('스트리머 신호는 점수를 올린다', () => {
  assert.ok(classify({ ...base, streamer: 4 }).score > classify({ ...base, streamer: 0 }).score);
});

const ids = (p, n) => Array.from({ length: n }, (_, i) => `${p}${i + 1}`);

test('슬롯: 재부상 5 + 신작 3 = 8개, 앞 3개는 재부상 2 + 신작 1', () => {
  const out = pickSlots(ids('r', 20), ids('n', 10), '2026-10-24:3');
  assert.equal(out.length, RISING_SLOTS + NEW_SLOTS);
  assert.deepEqual(out.slice(0, 3).map((x) => x[0]), ['r', 'r', 'n']);
  assert.equal(out.filter((x) => x[0] === 'r').length, 5);
  assert.equal(new Set(out).size, 8);
});

test('슬롯: 풀은 점수 상위 12·6개만, 같은 시드는 같은 결과, 다른 날은 다른 순서', () => {
  const a = pickSlots(ids('r', 40), ids('n', 20), '2026-10-24:3');
  assert.deepEqual(a, pickSlots(ids('r', 40), ids('n', 20), '2026-10-24:3'));
  assert.ok(a.every((x) => (x[0] === 'r' ? Number(x.slice(1)) <= 12 : Number(x.slice(1)) <= 6)));
  assert.notDeepEqual(a, pickSlots(ids('r', 40), ids('n', 20), '2026-10-25:3'));
});

test('슬롯: 신작이 모자라면 재부상으로, 재부상이 모자라면 신작으로 채운다', () => {
  const few = pickSlots(ids('r', 20), ids('n', 1), 'k');
  assert.equal(few.length, 8);
  assert.equal(few.filter((x) => x[0] === 'n').length, 1);
  const none = pickSlots(ids('r', 2), ids('n', 10), 'k');
  assert.equal(none.length, 8);
  assert.equal(none.filter((x) => x[0] === 'r').length, 2);
  assert.equal(pickSlots([], [], 'k').length, 0);
  assert.equal(pickSlots(ids('r', 3), [], 'k').length, 3);
});

test('pickDaily: 개수만큼, 원본은 안 바뀜', () => {
  const pool = ids('x', 10);
  assert.equal(pickDaily(pool, 4, 'k').length, 4);
  assert.deepEqual(pool, ids('x', 10));
});
