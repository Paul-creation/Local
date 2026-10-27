import test from 'node:test';
import assert from 'node:assert/strict';
import { parseState, serializeState, decide, advance, isBot, pageOf, placeBubble, orderParts, TOUR_STEPS, TOUR_TOTAL } from './tour.ts';

const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/130 Safari/537.36';
const run = (step) => serializeState({ status: 'running', step });

test('저장값 읽기: 없음·정상·깨진 값', () => {
  assert.equal(parseState(null), null);
  assert.deepEqual(parseState(run(2)), { status: 'running', step: 2 });
  assert.deepEqual(parseState('{"status":"skipped","step":9}'), { status: 'skipped', step: 0 });
  assert.equal(parseState('쓰레기').status, 'done');
});

test('첫 방문 + 홈이면 시작, 검색 조건·다른 페이지·봇이면 시작 안 함', () => {
  assert.deepEqual(decide(null, '/', '', UA), { kind: 'start' });
  assert.equal(decide(null, '/', '?sale=1', UA).kind, 'none');
  assert.equal(decide(null, '/guide', '', UA).kind, 'none');
  assert.equal(decide(null, '/', '', 'Mozilla/5.0 (compatible; Googlebot/2.1)').kind, 'none');
  assert.equal(decide(null, '/', '', '').kind, 'none');
});

test('끝냈거나 건너뛴 사람에게는 다시 안 뜸', () => {
  assert.equal(decide(serializeState({ status: 'done', step: 0 }), '/', '', UA).kind, 'none');
  assert.equal(decide(serializeState({ status: 'skipped', step: 1 }), '/', '', UA).kind, 'none');
});

test('진행 중: 그 단계의 페이지에서만 이어가고 다른 페이지면 종료', () => {
  assert.deepEqual(decide(run(1), '/', '', UA), { kind: 'resume', step: 1 });
  assert.deepEqual(decide(run(2), '/games/abc', '', UA), { kind: 'resume', step: 2 });
  assert.equal(decide(run(2), '/', '', UA).kind, 'end');
  assert.equal(decide(run(0), '/community', '', UA).kind, 'end');
  assert.equal(decide(run(3), '/games/abc/extra', '', UA).kind, 'end');
});

test('단계 진행: 마지막 다음은 마무리', () => {
  assert.equal(advance(0), 1);
  assert.equal(advance(TOUR_TOTAL - 2), TOUR_TOTAL - 1);
  assert.equal(advance(TOUR_TOTAL - 1), 'finale');
});

test('단계 정의: 카드 → 상세 이동 경계, 설명만 보는 단계는 3번 하나', () => {
  assert.deepEqual(TOUR_STEPS.map((s) => s.page), ['home', 'home', 'detail', 'detail']);
  assert.deepEqual(TOUR_STEPS.filter((s) => s.action === 'button').map((s) => s.id), ['info']);
});

test('pageOf·isBot', () => {
  assert.equal(pageOf('/'), 'home');
  assert.equal(pageOf('/games/x1'), 'detail');
  assert.equal(pageOf('/games'), null);
  assert.equal(isBot(UA), false);
  assert.equal(isBot('Yeti/1.1 (NHN Corp.)'), true);
});

test('말풍선 자리: 아래 기본, 아래가 모자라면 위, 둘 다 안 되면 겹침', () => {
  const b = { w: 300, h: 160 };
  const mid = placeBubble({ left: 100, top: 100, width: 200, height: 40 }, b, 1000, 800);
  assert.equal(mid.side, 'below');
  assert.equal(mid.top, 158);
  assert.ok(mid.tailX >= 22 && mid.tailX <= 278);
  const low = placeBubble({ left: 100, top: 700, width: 200, height: 40 }, b, 1000, 800);
  assert.equal(low.side, 'above');
  assert.equal(low.top, 700 - 18 - 160);
  const tall = placeBubble({ left: 100, top: 10, width: 200, height: 780 }, b, 1000, 800);
  assert.equal(tall.side, 'over');
  assert.equal(tall.tailX, null);
});

test('말풍선은 화면 가로 안에 머문다 (375px)', () => {
  const p = placeBubble({ left: 330, top: 100, width: 40, height: 30 }, { w: 300, h: 150 }, 375, 700);
  assert.ok(p.left >= 16 && p.left + 300 <= 375 - 16 + 1);
});

test('좁은 화면 3단계 분할: 위에 있는 대상부터, 하나뿐이면 하나만', () => {
  assert.deepEqual(orderParts({ 'stat-tiles': 90, 'price-card': 700 }).map((p) => p.target), ['stat-tiles', 'price-card']);
  assert.deepEqual(orderParts({ 'stat-tiles': 900, 'price-card': 200 }).map((p) => p.target), ['price-card', 'stat-tiles']);
  assert.deepEqual(orderParts({ 'price-card': 200 }).map((p) => p.target), ['price-card']);
  assert.deepEqual(orderParts({}), []);
});
